import type { Child, RecurringItem, Item } from '../types';
import { getBag } from '../types';
import { jstWeekdayNum, jstDateOffset } from './date';

export function matchesRecurring(rule: RecurringItem, isoDate: string): boolean {
  if (rule.startDate && isoDate < rule.startDate) return false;
  const wdNum = jstWeekdayNum(isoDate);

  if (rule.type === 'weekly') {
    if (!(rule.weekdays ?? []).includes(wdNum)) return false;
    const interval = rule.interval ?? 1;
    if (interval <= 1) return true;
    if (!rule.anchorDate) return true;
    const getMon = (iso: string): Date => {
      const d = new Date(iso + 'T00:00:00Z');
      const day = d.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setUTCDate(d.getUTCDate() + diff);
      return d;
    };
    const anchorMon = getMon(rule.anchorDate);
    const targetMon = getMon(isoDate);
    const weeksDiff = Math.round(
      (targetMon.getTime() - anchorMon.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return weeksDiff % interval === 0;
  }

  if (rule.type === 'monthly') {
    const mp = rule.monthlyPattern;
    if (!mp) return false;
    const d = new Date(isoDate + 'T00:00:00Z');
    const domDay = d.getUTCDate();
    const domMonth = d.getUTCMonth();
    const domYear = d.getUTCFullYear();

    if (mp.kind === 'dayOfMonth') {
      return domDay === mp.day;
    }
    if (mp.kind === 'nthWeekday') {
      if (wdNum !== mp.weekday) return false;
      const firstOfMonth = new Date(Date.UTC(domYear, domMonth, 1));
      const firstWd = firstOfMonth.getUTCDay();
      const diff = (mp.weekday - firstWd + 7) % 7;
      const firstOccurrence = 1 + diff;
      const nth = Math.floor((domDay - firstOccurrence) / 7) + 1;
      return nth === mp.nth;
    }
  }

  return false;
}

/**
 * その日が「デフォルトを自動適用する対象日」か。
 * 今日以降(過去日は履歴として尊重)かつ登園日(休園日でない)に適用する。
 */
export function appliesDefaults(date: string, closedWeekdays: number[]): boolean {
  if (date < jstDateOffset(0)) return false; // 過去日は対象外
  if (closedWeekdays.includes(jstWeekdayNum(date))) return false; // 休園日は対象外
  return true;
}

/**
 * 表示する品目カウントを返す。優先順位は ユーザー編集(bag.items) > 定期ルール > デフォルト。
 * closedWeekdays を渡すと、今日以降の登園日には未編集の項目にデフォルトを下敷きとして適用する。
 * bag.items の値がルール/デフォルトを上書きする。bag.items[key]=0 は「ユーザーが明示的にゼロにした」を意味する。
 */
export function effectiveItems(
  child: Child,
  date: string,
  closedWeekdays?: number[]
): Record<string, number> {
  const bag = getBag(child, date);
  const merged: Record<string, number> = {};

  // 最下層: デフォルト(今日以降の登園日のみ)
  if (closedWeekdays && appliesDefaults(date, closedWeekdays)) {
    for (const [k, v] of Object.entries(child.defaults ?? {})) {
      if (v > 0) merged[k] = v;
    }
  }

  // 中間層: 定期ルール
  for (const rule of child.recurringItems ?? []) {
    if (matchesRecurring(rule, date)) {
      merged[rule.itemKey] = rule.qty;
    }
  }

  // 最上層: その日のユーザー編集
  for (const [k, v] of Object.entries(bag.items)) {
    merged[k] = v;
  }

  // 0 は表示しない(ユーザーが品目を明示的にゼロにした場合など)
  for (const k of Object.keys(merged)) {
    if (merged[k] === 0) delete merged[k];
  }

  return merged;
}

/** bag.items に存在しない(= ユーザー未編集の)定期品目キーのセット。🔁 バッジ表示用 */
export function recurringKeys(child: Child, date: string): Set<string> {
  const bag = getBag(child, date);
  const result = new Set<string>();
  for (const rule of child.recurringItems ?? []) {
    if (matchesRecurring(rule, date) && !(rule.itemKey in bag.items)) {
      result.add(rule.itemKey);
    }
  }
  return result;
}

export function ruleLabel(rule: RecurringItem, allItems: Item[]): string {
  const item = allItems.find((i) => i.key === rule.itemKey);
  const emoji = item?.emoji ?? '📦';
  const qty = rule.qty > 1 ? ` · ${rule.qty}個` : '';
  const startSuffix = rule.startDate
    ? `  (${rule.startDate.slice(5).replace('-', '/')}〜)`
    : '';
  if (rule.type === 'weekly') {
    const wdLabels = (rule.weekdays ?? []).map((w) => '日月火水木金土'[w]).join('・');
    const interval = rule.interval ?? 1;
    const prefix =
      interval === 1 ? '毎週' : interval === 2 ? '隔週' : `${interval}週ごと`;
    return `${emoji} ${rule.itemKey}${qty}  ${prefix}${wdLabels}${startSuffix}`;
  }
  if (rule.type === 'monthly') {
    const mp = rule.monthlyPattern;
    if (mp?.kind === 'dayOfMonth')
      return `${emoji} ${rule.itemKey}${qty}  毎月${mp.day}日${startSuffix}`;
    if (mp?.kind === 'nthWeekday') {
      const wdLabel = '日月火水木金土'[mp.weekday];
      return `${emoji} ${rule.itemKey}${qty}  毎月第${mp.nth}${wdLabel}曜日${startSuffix}`;
    }
  }
  return `${emoji} ${rule.itemKey}${qty}`;
}
