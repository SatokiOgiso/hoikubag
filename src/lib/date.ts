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

/** JST の曜日番号を返す。0=日..6=土 */
export function jstWeekdayNum(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00Z').getUTCDay();
}

/** 保育園のある直近の登園日(startOffset 以降)を返す。closedWeekdays: 0=日..6=土 */
export function nextDaycareDay(closedWeekdays: number[], startOffset = 1): string {
  for (let off = startOffset; off < startOffset + 7; off++) {
    const d = jstDateOffset(off);
    if (!closedWeekdays.includes(jstWeekdayNum(d))) return d;
  }
  return jstDateOffset(startOffset); // 全曜日が休みのフォールバック
}

/** 現在の JST 時刻を 0:00 からの経過分(0〜1439)で返す */
export function jstMinutesOfDay(base: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(base);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return h * 60 + m;
}

/**
 * 表示の切り替え時刻(分)を踏まえた既定の選択日。
 * 切り替え時刻より前は当日から、以降は翌日からの「次の登園日」を返す。
 * 例: 7:30(=450分)設定なら、朝7:30までは当日の準備、それ以降は次の登園日を初期表示。
 */
export function defaultSelectedDate(closedWeekdays: number[], rolloverMinutes: number): string {
  const before = jstMinutesOfDay() < rolloverMinutes;
  return nextDaycareDay(closedWeekdays, before ? 0 : 1);
}

/** 分(0〜1439)を "HH:MM" 文字列に整形 */
export function minutesToHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "HH:MM" を分に変換。不正な値なら NaN を返す。 */
export function hhmmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
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

/**
 * 編集日時(Unix ms)を相対表現にする。例: "たった今" "5分前" "3時間前" "昨日 14:30" "5/28 9:05"。
 * JST 基準。
 */
export function relativeEditedAt(ts: number | undefined | null, now: number = Date.now()): string {
  if (!ts) return '';
  const diff = now - ts;
  if (diff < 0) return 'たった今';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;

  // 時刻(JST)
  const hm = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts));

  const tsDate = jstDateOffset(0, new Date(ts));
  if (tsDate === jstDateOffset(-1)) return `昨日 ${hm}`;
  // それ以前は M/D HH:MM
  const [, mm, dd] = tsDate.split('-');
  return `${Number(mm)}/${Number(dd)} ${hm}`;
}
