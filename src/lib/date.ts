/** ランダムなID生成 */
export const uid = (): string => Math.random().toString(36).slice(2, 10);

/** 「5月30日(金)」のような明日の日付ラベル */
export function tomorrowLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${dow})`;
}
