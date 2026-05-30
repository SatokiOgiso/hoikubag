import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Web Push の購読管理。
 *
 *   GET  /api/push?action=key                → VAPID 公開鍵
 *   POST /api/push?action=subscribe          → 購読を登録 { subscription, familyId }
 *   POST /api/push?action=unsubscribe        → 購読を解除 { endpoint }
 *
 * 購読は Upstash Redis のハッシュ `push:subs` に
 *   field = endpoint, value = JSON.stringify({ subscription, familyId })
 * で保存する。Cron(api/cron.ts)がここから全件読み出して送信する。
 */

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;

export const SUBS_KEY = 'push:subs';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawAction = req.query.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : rawAction;

  try {
    if (req.method === 'GET' && action === 'key') {
      if (!VAPID_PUBLIC) return res.status(500).json({ error: 'VAPID 未設定' });
      return res.status(200).json({ publicKey: VAPID_PUBLIC });
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Record<string, unknown>);

      if (action === 'subscribe') {
        const subscription = body?.subscription as { endpoint?: string } | undefined;
        const familyId = (body?.familyId as string | null) ?? null;
        if (!subscription?.endpoint) {
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
        if (!endpoint) return res.status(400).json({ error: 'invalid endpoint' });
        await redis(['HDEL', SUBS_KEY, endpoint]);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'unknown action' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'server error';
    return res.status(500).json({ error: message });
  }
}
