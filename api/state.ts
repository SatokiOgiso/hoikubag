import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 家族間共有用の状態ストア(Vercel Serverless Function)。
 *
 * Upstash Redis(Vercel Marketplace の無料枠)に `family:<familyId>` キーで
 * AppState の JSON を保存する。環境変数は Vercel の Upstash 連携が自動設定する
 * `KV_REST_API_URL` / `KV_REST_API_TOKEN`(または Upstash 既定の
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`)を利用する。
 *
 *   GET  /api/state?f=<familyId>  → 保存済み AppState(なければ null)
 *   POST /api/state?f=<familyId>  → AppState を保存(updatedAt の新しい方を採用)
 */

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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

function isValidFamilyId(f: unknown): f is string {
  return typeof f === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(f);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.f;
  const familyId = Array.isArray(raw) ? raw[0] : raw;
  if (!isValidFamilyId(familyId)) {
    return res.status(400).json({ error: 'invalid family id' });
  }
  const key = `family:${familyId}`;

  try {
    if (req.method === 'GET') {
      const stored = await redis(['GET', key]);
      return res.status(200).json(typeof stored === 'string' ? JSON.parse(stored) : null);
    }

    if (req.method === 'POST') {
      const incoming =
        typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Record<string, unknown>);
      if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.children)) {
        return res.status(400).json({ error: 'invalid body' });
      }
      // 競合解決: updatedAt の新しい方を採用(last-write-wins)
      const storedRaw = await redis(['GET', key]);
      const stored =
        typeof storedRaw === 'string' ? (JSON.parse(storedRaw) as Record<string, unknown>) : null;
      const storedAt = stored ? Number(stored.updatedAt) || 0 : 0;
      const incomingAt = Number(incoming.updatedAt) || 0;
      if (stored && storedAt > incomingAt) {
        return res.status(200).json(stored);
      }
      await redis(['SET', key, JSON.stringify(incoming)]);
      return res.status(200).json(incoming);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'server error';
    return res.status(500).json({ error: message });
  }
}
