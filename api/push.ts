import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';

/**
 * Web Push の購読管理。
 *
 *   GET  /api/push?action=key                → VAPID 公開鍵
 *   POST /api/push?action=subscribe          → 購読を登録 { subscription, familyId }
 *   POST /api/push?action=unsubscribe        → 購読を解除 { endpoint }
 *   POST /api/push?action=notify             → 家族へ確定のお願いを送信 { familyId, excludeEndpoint? }
 *
 * 購読は Upstash Redis のハッシュ `push:subs` に
 *   field = endpoint, value = JSON.stringify({ subscription, familyId })
 * で保存する。Cron(api/cron.ts)がここから全件読み出して送信する。
 */

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

export const SUBS_KEY = 'push:subs';

/**
 * 鍵を URL-safe Base64(パディング無し)に正規化する。
 * VAPID 鍵が標準 Base64(末尾 "="、"+" "/" を含む)で保存されていると
 * web-push が「URL safe Base 64 でない」と拒否するため、送信前に整える。
 */
export function toUrlSafeBase64(key: string): string {
  return key.trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface StoredSub {
  subscription: webpush.PushSubscription;
  familyId: string | null;
}

export async function redis(command: unknown[]): Promise<unknown> {
  if (!KV_URL || !KV_TOKEN) throw new Error('KV (Upstash Redis) が未設定です');
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`KV エラー ${r.status}`);
  const data = (await r.json()) as { result?: unknown };
  return data.result ?? null;
}

function clientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  return (raw?.split(',')[0]?.trim() || (req.headers['x-real-ip'] as string) || 'unknown').slice(0, 64);
}

/** 簡易レート制限(固定窓)。Redis 障害時はフェイルオープン(通す)。 */
async function rateLimited(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const n = Number(await redis(['INCR', bucket]));
    if (n === 1) await redis(['EXPIRE', bucket, windowSec]);
    return n > limit;
  } catch {
    return false;
  }
}

function isValidFamilyId(f: unknown): f is string {
  return typeof f === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(f);
}

/** Push サービスの endpoint が https の URL か(任意URLの登録による悪用を防ぐ) */
function isHttpsUrl(s: unknown): s is string {
  if (typeof s !== 'string' || s.length > 2048) return false;
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawAction = req.query.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : rawAction;

  try {
    if (req.method === 'GET' && action === 'key') {
      if (!VAPID_PUBLIC) return res.status(500).json({ error: 'VAPID 未設定' });
      return res.status(200).json({ publicKey: VAPID_PUBLIC });
    }

    if (req.method === 'POST') {
      // IP 単位のレート制限(購読の大量登録・通知スパムの抑止)
      if (await rateLimited(`rl:push:${clientIp(req)}`, 60, 60)) {
        return res.status(429).json({ error: 'too many requests' });
      }

      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Record<string, unknown>);

      if (action === 'subscribe') {
        const subscription = body?.subscription as { endpoint?: string } | undefined;
        const rawFamilyId = (body?.familyId as string | null) ?? null;
        const familyId = isValidFamilyId(rawFamilyId) ? rawFamilyId : null;
        // endpoint は実在の Push サービス(https)に限る
        if (!subscription || !isHttpsUrl(subscription.endpoint)) {
          return res.status(400).json({ error: 'invalid subscription' });
        }
        await redis([
          'HSET',
          SUBS_KEY,
          subscription.endpoint,
          JSON.stringify({ subscription, familyId }),
        ]);
        return res.status(200).json({ ok: true });
      }

      if (action === 'unsubscribe') {
        const endpoint = body?.endpoint as string | undefined;
        if (!isHttpsUrl(endpoint)) return res.status(400).json({ error: 'invalid endpoint' });
        await redis(['HDEL', SUBS_KEY, endpoint]);
        return res.status(200).json({ ok: true });
      }

      // 家族の誰かが「中身を確定して」と能動的にお願いを送る。
      // 同じ familyId の購読(送信者自身の端末は除く)へプッシュする。
      if (action === 'notify') {
        const familyId = body?.familyId as string | undefined;
        const excludeEndpoint = (body?.excludeEndpoint as string | null) ?? null;
        if (!isValidFamilyId(familyId)) return res.status(400).json({ error: 'familyId required' });
        // 家族単位でも通知の連投を抑える(スパム防止)
        if (await rateLimited(`rl:notify:${familyId}`, 5, 60)) {
          return res.status(429).json({ error: 'too many requests' });
        }
        if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
          return res.status(500).json({ error: 'VAPID 未設定' });
        }
        webpush.setVapidDetails(
          VAPID_SUBJECT,
          toUrlSafeBase64(VAPID_PUBLIC),
          toUrlSafeBase64(VAPID_PRIVATE)
        );

        const flat = (await redis(['HGETALL', SUBS_KEY])) as string[] | null;
        const payload = JSON.stringify({
          title: '💬 今日のこと、聞かせて',
          body: '家族が今日のことを知りたがっています。保育園のこと、ひとこと残してみませんか?',
          url: '/',
          tag: 'hoikubag-confirm-request',
        });

        let sent = 0;
        let removed = 0;
        for (let i = 0; flat && i < flat.length; i += 2) {
          const endpoint = flat[i];
          if (endpoint === excludeEndpoint) continue;
          let stored: StoredSub;
          try {
            stored = JSON.parse(flat[i + 1]) as StoredSub;
          } catch {
            continue;
          }
          if (stored.familyId !== familyId) continue;
          try {
            await webpush.sendNotification(stored.subscription, payload);
            sent++;
          } catch (e: unknown) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await redis(['HDEL', SUBS_KEY, endpoint]);
              removed++;
            }
          }
        }
        return res.status(200).json({ ok: true, sent, removed });
      }

      return res.status(400).json({ error: 'unknown action' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    // 詳細はログにのみ残し、応答は一般化する
    console.error('[api/push] error', { action, error: e });
    return res.status(500).json({ error: 'server error' });
  }
}
