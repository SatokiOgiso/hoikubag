/** ランダムなID生成 */
export const uid = (): string => Math.random().toString(36).slice(2, 10);

/** JST 基準で offset 日後の日付(YYYY-MM-DD)。昨日=-1, 今日=0, 明日=1 */
export function jstDateOffset(offset: number, base: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // JST の暦日を UTC 上で表現して offset 日加算(タイムゾーンの影響を受けない)
  const d = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** JST の曜日(短縮)を返す。例: "日" */
export function jstWeekday(isoDate: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
  }).format(new Date(`${isoDate}T00:00:00+09:00`));
}

/** 「5月31日(日)」のような日付ラベル(JST基準)。相対語(昨日/今日/明日)も前置 */
export function dateLabel(isoDate: string): string {
  const [, mm, dd] = isoDate.split('-');
  const base = `${Number(mm)}月${Number(dd)}日(${jstWeekday(isoDate)})`;
  let rel = '';
  if (isoDate === jstDateOffset(-1)) rel = '昨日 · ';
  else if (isoDate === jstDateOffset(0)) rel = '今日 · ';
  else if (isoDate === jstDateOffset(1)) rel = '明日 · ';
  return rel + base;
}
