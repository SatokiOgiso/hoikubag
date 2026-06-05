import type { DocEntry, DocCategory } from '../types';
import { jstDateOffset } from './date';

export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  request: '依頼書類',
  event: 'イベント案内',
  other: 'その他',
};

export const DOC_CATEGORY_EMOJI: Record<DocCategory, string> = {
  request: '📋',
  event: '🎪',
  other: '📄',
};

/** 自分(myName)がまだ確認していない書類の件数。myName 未設定なら0 */
export function unconfirmedDocCount(docs: DocEntry[], myName: string): number {
  const me = myName.trim();
  if (!me) return 0;
  return docs.filter((d) => !(d.confirmedBy ?? []).includes(me)).length;
}

/** 日付ラベル。例: "6/20まで" "今日" "期限切れ 6/1"(イベント/期限の別はカテゴリで判断) */
export function docDateLabel(date: string | undefined, today: string = jstDateOffset(0)): string {
  if (!date) return '';
  const [, mm, dd] = date.split('-');
  const md = `${Number(mm)}/${Number(dd)}`;
  if (date === today) return `今日 ${md}`;
  if (date === jstDateOffset(1)) return `明日 ${md}`;
  if (date < today) return `${md}(済)`;
  return md;
}

/** 日付が今日より前か(過ぎたイベント/期限の薄字表示に使う) */
export function isDocDatePast(date: string | undefined, today: string = jstDateOffset(0)): boolean {
  return !!date && date < today;
}

/**
 * 表示用の並び替え。
 * 日付あり(近い順)→日付なし(新しい順)。過ぎた日付は後ろ。
 */
export function sortDocs(docs: DocEntry[], today: string = jstDateOffset(0)): DocEntry[] {
  return [...docs].sort((a, b) => {
    const aPast = isDocDatePast(a.date, today);
    const bPast = isDocDatePast(b.date, today);
    if (aPast !== bPast) return aPast ? 1 : -1; // 過ぎたものは後ろ
    if (a.date && b.date) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return b.createdAt - a.createdAt;
    }
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return b.createdAt - a.createdAt;
  });
}
