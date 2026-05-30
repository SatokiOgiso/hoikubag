import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { redis, SUBS_KEY } from './push';

/**
 * 毎晩の準備リマインドを全購読へ送信する Cron(vercel.json で時刻指定)。
 *
 * - 共有家族の購読: 翌登園日が「全員確定済み」なら送信をスキップ
 * - 共有なしの購読: 無条件でリマインド
 * - 期限切れ(410/404)の購読は掃除する
 *
 * Vercel Cron は Authorization: Bearer <CRON_SECRET> を付けて叩く。
 */

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const CRON_SECRET = process.env.CRON_SECRET;

// ---- JST 日付ユーティリティ(api/state と同等のロジックを自前で持つ) ----
function jstDateOffset(offset: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const d = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
function weekdayNum(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00Z').getUTCDay();
}
function nextDaycareDay(closedWeekdays: number[]): string {
  for (let off = 1; off < 8; off++) {
    const d = jstDateOffset(off);
    if (!closedWeekdays.includes(weekdayNum(d))) return d;
  }
  return jstDateOffset(1);
}

interface StoredSub {
  subscription: webpush.PushSubscription;
  familyId: string | null;
}

/** 共有家族が翌登園日を全員確定済みかどうか(true ならスキップしてよい) */
async function familyAllConfirmed(familyId: string): Promise<boolean> {
  try {
    const raw = await redis(['GET', `family:${familyId}`]);
    if (typeof raw !== 'string') return false;
    const state = JSON.parse(raw) as {
      children?: { bags?: Record<string, { confirmed?: boolean }> }[];
      closedWeekdays?: number[];
    };
    const children = state.children ?? [];
    if (children.length === 0) return false;
    const target = nextDaycareDay(state.closedWeekdays ?? [0, 6]);
    return children.every((c) => c.bags?.[target]?.confirmed === true);
  } catch {
    return false; // 判定できない時は安全側(送る)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cron 認証(手動叩き防止)
  if (CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: 'VAPID 未設定' });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  try {
    // push:subs ハッシュ全件(endpoint, value, endpoint, value, ...)
    const flat = (await redis(['HGETALL', SUBS_KEY])) as string[] | null;
    if (!flat || flat.length === 0) {
      return res.status(200).json({ sent: 0, skipped: 0, removed: 0 });
    }

    const entries: { endpoint: string; stored: StoredSub }[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      try {
        entries.push({ endpoint: flat[i], stored: JSON.parse(flat[i + 1]) as StoredSub });
      } catch {
        /* 壊れたエントリは無視 */
      }
    }

    // 家族の確定状態をまとめて判定(同じ familyId は1回だけ問い合わせ)
    const confirmedCache = new Map<string, boolean>();
    let sent = 0;
    let skipped = 0;
    let removed = 0;

    const payload = JSON.stringify({
      title: '保育園の準備リマインド',
      body: '明日の持ち物の準備はできていますか?',
      url: '/',
      tag: 'hoikubag-reminder',
    });

    for (const { endpoint, stored } of entries) {
      // 共有家族で全員確定済みならスキップ
      if (stored.familyId) {
        let done = confirmedCache.get(stored.familyId);
        if (done === undefined) {
          done = await familyAllConfirmed(stored.familyId);
          confirmedCache.set(stored.familyId, done);
        }
        if (done) {
          skipped++;
          continue;
        }
      }

      try {
        await webpush.sendNotification(stored.subscription, payload);
        sent++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // 失効した購読は掃除
          await redis(['HDEL', SUBS_KEY, endpoint]);
          removed++;
        }
      }
    }

    return res.status(200).json({ sent, skipped, removed });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'server error';
    return res.status(500).json({ error: message });
  }
}
