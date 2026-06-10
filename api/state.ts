import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 家族間共有用の状態ストア(Vercel Serverless Function)。
 *
 * Upstash Redis(Vercel Marketplace の無料枠)に `family:<familyId>` キーで
 * AppState の JSON を保存する。環境変数は Vercel の Upstash 連携が自動設定する
 * `KV_REST_API_URL` / `KV_REST_API_TOKEN`(または Upstash 既定の
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`)を利用する。
 *
 *   GET    /api/state?f=<familyId>  → 保存済み AppState(なければ null)
 *   POST   /api/state?f=<familyId>  → AppState を保存(updatedAt の新しい方を採用)
 *   DELETE /api/state?f=<familyId>  → クラウド上の家族データを削除
 */

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// 保存できる状態の最大サイズ(肥大化・枠の枯渇を防ぐ)
const MAX_BODY_BYTES = 256 * 1024; // 256KB
// アクセスのある家族のみ保持し、長期放置データは自動で掃除する。読み書きのたびに延長。
const STATE_TTL_SECONDS = 60 * 60 * 24 * 400; // 約400日
// updatedAt の未来方向の許容(これを超える申告は今に丸めて恒久ロックアウトを防ぐ)
const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000; // 1日

async function redis(command: unknown[]): Promise<unknown> {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV (Upstash Redis) が未設定です');
  }
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) {
    throw new Error(`KV エラー ${r.status}`);
  }
  const data = (await r.json()) as { result?: unknown };
  return data.result ?? null;
}

function clientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  return (raw?.split(',')[0]?.trim() || (req.headers['x-real-ip'] as string) || 'unknown').slice(0, 64);
}

/**
 * 簡易レート制限(Upstash の INCR/EXPIRE による固定窓)。
 * Redis 障害時はフェイルオープン(通す)。通常の家族利用では到達しない上限にする。
 */
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

/** 保存してよい形か(最低限の構造チェック) */
function isPlausibleState(o: unknown): o is Record<string, unknown> {
  return !!o && typeof o === 'object' && Array.isArray((o as Record<string, unknown>).children);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.f;
  const familyId = Array.isArray(raw) ? raw[0] : raw;
  if (!isValidFamilyId(familyId)) {
    return res.status(400).json({ error: 'invalid family id' });
  }
  const key = `family:${familyId}`;

  // IP 単位のレート制限(総当たり・大量書き込みの抑止)
  if (await rateLimited(`rl:state:${clientIp(req)}`, 120, 60)) {
    return res.status(429).json({ error: 'too many requests' });
  }

  try {
    if (req.method === 'GET') {
      const stored = await redis(['GET', key]);
      if (typeof stored === 'string') {
        // アクセスのある家族は期限を延長(放置データだけが期限切れになる)
        try {
          await redis(['EXPIRE', key, STATE_TTL_SECONDS]);
        } catch {
          /* TTL 延長失敗は致命的でないため無視 */
        }
        return res.status(200).json(JSON.parse(stored));
      }
      return res.status(200).json(null);
    }

    if (req.method === 'POST') {
      // サイズ上限(肥大化・枠枯渇の防止)
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? '');
      if (rawBody.length > MAX_BODY_BYTES) {
        return res.status(413).json({ error: 'payload too large' });
      }
      const incoming =
        typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Record<string, unknown>);
      if (!isPlausibleState(incoming)) {
        return res.status(400).json({ error: 'invalid body' });
      }

      const now = Date.now();
      // クライアント申告の updatedAt を未来方向にクランプ(恒久ロックアウトの防止)
      let incomingAt = Number(incoming.updatedAt) || 0;
      if (incomingAt > now + CLOCK_SKEW_MS) {
        incomingAt = now;
        incoming.updatedAt = now;
      }

      // 競合解決: updatedAt の新しい方を採用(last-write-wins)
      const storedRaw = await redis(['GET', key]);
      const stored =
        typeof storedRaw === 'string' ? (JSON.parse(storedRaw) as Record<string, unknown>) : null;
      let storedAt = stored ? Number(stored.updatedAt) || 0 : 0;
      // 既に未来日付で汚染された値があっても締め出されないようにする
      if (storedAt > now + CLOCK_SKEW_MS) storedAt = 0;
      if (stored && storedAt > incomingAt) {
        return res.status(200).json(stored);
      }
      await redis(['SET', key, JSON.stringify(incoming), 'EX', STATE_TTL_SECONDS]);
      return res.status(200).json(incoming);
    }

    if (req.method === 'DELETE') {
      await redis(['DEL', key]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    // 内部エラーの詳細はログにのみ残し、応答は一般化する
    console.error('[api/state] error', e);
    return res.status(500).json({ error: 'server error' });
  }
}
