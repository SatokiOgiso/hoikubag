import type { Child } from '../types';
import { effectiveItems } from './recurring';
import { jstDateOffset } from './date';

/** 子ども1人分の集計結果(指定期間)。集計対象は「確定した日」のみ。 */
export interface ChildStats {
  childId: string;
  childName: string;
  days: number; // 確定した日数
  totalItems: number; // 用意したアイテムの合計個数
  byItem: Record<string, number>; // 品目ごとの合計個数
}

/** 直近 n 日の日付(YYYY-MM-DD)配列。今日を含む過去 n 日(昇順)。 */
export function getLastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(jstDateOffset(-i));
  return out;
}

/**
 * 子どもの統計を集計する。確定した日(confirmed === true)だけを対象にする。
 * dateSet を渡すとその日付集合に絞る(直近1ヶ月など)。省略時は全期間。
 * 各確定日の品目数量は effectiveItems(その日に表示されていた実数量)で数える。
 */
export function calcChildStats(
  child: Child,
  closedWeekdays: number[],
  dateSet?: Set<string>
): ChildStats {
  const byItem: Record<string, number> = {};
  let days = 0;
  let totalItems = 0;
  for (const [date, bag] of Object.entries(child.bags ?? {})) {
    if (!bag.confirmed) continue;
    if (dateSet && !dateSet.has(date)) continue;
    days++;
    const eff = effectiveItems(child, date, closedWeekdays);
    for (const [key, qty] of Object.entries(eff)) {
      byItem[key] = (byItem[key] ?? 0) + qty;
      totalItems += qty;
    }
  }
  return { childId: child.id, childName: child.name, days, totalItems, byItem };
}

/** byItem を個数の多い順に並べた配列にする。 */
export function rankItems(byItem: Record<string, number>): [string, number][] {
  return Object.entries(byItem).sort((a, b) => b[1] - a[1]);
}

/** 線形ステップのしきい値列を生成。first を指定すると最初のバッジだけ別の値にできる。 */
function* milestoneSeq(step: number, first: number): Generator<number> {
  if (first !== step) yield first;
  let m = step;
  while (true) {
    yield m;
    m += step;
  }
}

/** バッジ進捗。step ごとに1つ付与(例: 10,20,30…)。指数的でなく定期的に獲得できる。 */
export interface BadgeProgress {
  earnedCount: number; // 獲得済みバッジ数
  lastMilestone: number; // 直近で達成したしきい値(なければ 0)
  nextTarget: number; // 次のしきい値
  toNext: number; // 次のバッジまであといくつ
  progress: number; // 直近達成 → 次への進捗(0..1)
}

export function computeBadges(value: number, step: number, first = step): BadgeProgress {
  const gen = milestoneSeq(step, first);
  let earnedCount = 0;
  let lastMilestone = 0;
  let nextTarget = 0;
  // しきい値を順に見て、value を超えた最初のものを「次の目標」とする
  for (;;) {
    const m = gen.next().value as number;
    if (m <= value) {
      earnedCount++;
      lastMilestone = m;
    } else {
      nextTarget = m;
      break;
    }
  }
  const span = nextTarget - lastMilestone;
  const progress = span > 0 ? (value - lastMilestone) / span : 0;
  return { earnedCount, lastMilestone, nextTarget, toNext: nextTarget - value, progress };
}

/** バッジ帯に表示する一区間のメダル。 */
export interface BadgeMedal {
  value: number; // しきい値
  earned: boolean; // 達成済みか
  isNext: boolean; // 次に狙うバッジか
}

/**
 * 現在地点の前後だけを切り出したメダル列(無限に長くならないようにする)。
 * before 個の達成済み + 次 + after 個の未達 を返す。
 */
export function badgeWindow(
  value: number,
  step: number,
  first = step,
  before = 2,
  after = 2
): BadgeMedal[] {
  const { earnedCount, nextTarget } = computeBadges(value, step, first);
  const gen = milestoneSeq(step, first);
  const tiers: number[] = [];
  const total = earnedCount + 1 + after; // 達成済み + 次 + 未達 after 個
  for (let i = 0; i < total; i++) tiers.push(gen.next().value as number);
  const startIdx = Math.max(0, earnedCount - before);
  const out: BadgeMedal[] = [];
  for (let i = startIdx; i < tiers.length; i++) {
    const v = tiers[i];
    out.push({ value: v, earned: v <= value, isNext: v === nextTarget });
  }
  return out;
}
