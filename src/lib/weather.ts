import type { Forecast, DayForecast } from '../types';
import { jstDateOffset } from './date';

/**
 * 天気の自動取得(ハイブリッド)。
 *
 * - 今日・明日: **気象庁**オープンデータ(精度重視)
 *     GET https://www.jma.go.jp/bosai/forecast/data/forecast/{officeCode}.json
 * - 昨日(過去): **Open-Meteo**(気象庁の予報APIは過去日を返さないため)
 *     GET https://api.open-meteo.com/v1/forecast?...&past_days=1
 *
 * いずれも無料・APIキー不要・CORS 許可済みでブラウザから直接取得できる。
 * 気象庁が取得できない場合は Open-Meteo で今日・明日を補完する。
 */

// 都道府県名 → 気象庁 office コード(全47)
const JMA_OFFICES: Record<string, string> = {
  北海道: '016000', 青森県: '020000', 岩手県: '030000', 宮城県: '040000',
  秋田県: '050000', 山形県: '060000', 福島県: '070000', 茨城県: '080000',
  栃木県: '090000', 群馬県: '100000', 埼玉県: '110000', 千葉県: '120000',
  東京都: '130000', 神奈川県: '140000', 新潟県: '150000', 富山県: '160000',
  石川県: '170000', 福井県: '180000', 山梨県: '190000', 長野県: '200000',
  岐阜県: '210000', 静岡県: '220000', 愛知県: '230000', 三重県: '240000',
  滋賀県: '250000', 京都府: '260000', 大阪府: '270000', 兵庫県: '280000',
  奈良県: '290000', 和歌山県: '300000', 鳥取県: '310000', 島根県: '320000',
  岡山県: '330000', 広島県: '340000', 山口県: '350000', 徳島県: '360000',
  香川県: '370000', 愛媛県: '380000', 高知県: '390000', 福岡県: '400000',
  佐賀県: '410000', 長崎県: '420000', 熊本県: '430000', 大分県: '440000',
  宮崎県: '450000', 鹿児島県: '460100', 沖縄県: '471000',
};

// 都道府県名 → 県庁所在地の緯度経度(全47)
const PREF_COORDS: Record<string, [number, number]> = {
  北海道: [43.06, 141.35], 青森県: [40.82, 140.74], 岩手県: [39.70, 141.15],
  宮城県: [38.27, 140.87], 秋田県: [39.72, 140.10], 山形県: [38.24, 140.36],
  福島県: [37.75, 140.47], 茨城県: [36.34, 140.45], 栃木県: [36.57, 139.88],
  群馬県: [36.39, 139.06], 埼玉県: [35.86, 139.65], 千葉県: [35.61, 140.12],
  東京都: [35.69, 139.69], 神奈川県: [35.45, 139.64], 新潟県: [37.90, 139.02],
  富山県: [36.70, 137.21], 石川県: [36.59, 136.63], 福井県: [36.07, 136.22],
  山梨県: [35.66, 138.57], 長野県: [36.65, 138.18], 岐阜県: [35.39, 136.72],
  静岡県: [34.98, 138.38], 愛知県: [35.18, 136.91], 三重県: [34.73, 136.51],
  滋賀県: [35.00, 135.87], 京都府: [35.02, 135.76], 大阪府: [34.69, 135.50],
  兵庫県: [34.69, 135.20], 奈良県: [34.69, 135.83], 和歌山県: [34.23, 135.17],
  鳥取県: [35.50, 134.24], 島根県: [35.47, 133.05], 岡山県: [34.66, 133.93],
  広島県: [34.40, 132.46], 山口県: [34.19, 131.47], 徳島県: [34.07, 134.56],
  香川県: [34.34, 134.04], 愛媛県: [33.84, 132.77], 高知県: [33.56, 133.53],
  福岡県: [33.61, 130.42], 佐賀県: [33.25, 130.30], 長崎県: [32.74, 129.87],
  熊本県: [32.79, 130.74], 大分県: [33.24, 131.61], 宮崎県: [31.91, 131.42],
  鹿児島県: [31.56, 130.56], 沖縄県: [26.21, 127.68],
};

/** 完全名で一致 or 含む、で表から値を引く(京都/東京の誤マッチを回避) */
function lookup<T>(table: Record<string, T>, name: string): T | null {
  if (!name) return null;
  const n = name.trim();
  if (table[n]) return table[n];
  for (const key of Object.keys(table)) {
    if (n.includes(key)) return table[key];
  }
  return null;
}

export const resolveAreaCode = (name: string): string | null => lookup(JMA_OFFICES, name);
export const resolveCoords = (name: string): [number, number] | null => lookup(PREF_COORDS, name);

function toTemp(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '') return null; // 気象庁の tempsMax/Min は "" のことがある(0と誤認しない)
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const dateOf = (iso: unknown): string => String(iso).slice(0, 10);
const hasData = (d: DayForecast | null): d is DayForecast =>
  !!d && (d.high != null || d.low != null || !!d.label);

// ---- 気象庁 ----

/** 気象庁 forecast JSON から指定日(YYYY-MM-DD)の予報を取り出す */
export function parseJmaDay(json: unknown, date: string): DayForecast {
  const root = (Array.isArray(json) ? json : []) as any[];
  const short = root[0];
  const weekly = root[1];

  let label = '';
  let high: number | null = null;
  let low: number | null = null;

  // 天気テキスト: 短期予報 data[0].timeSeries[0]
  const wts = short?.timeSeries?.[0];
  if (Array.isArray(wts?.timeDefines)) {
    const i = wts.timeDefines.findIndex((t: unknown) => dateOf(t) === date);
    if (i >= 0) label = wts.areas?.[0]?.weathers?.[i] ?? '';
  }

  // 気温: 週間予報 data[1].timeSeries[1] を優先
  const wtemp = weekly?.timeSeries?.[1];
  if (Array.isArray(wtemp?.timeDefines)) {
    const i = wtemp.timeDefines.findIndex((t: unknown) => dateOf(t) === date);
    if (i >= 0) {
      const a = wtemp.areas?.[0];
      high = toTemp(a?.tempsMax?.[i]);
      low = toTemp(a?.tempsMin?.[i]);
    }
  }

  // フォールバック: 短期予報の気温 data[0].timeSeries[2]
  if (high == null && low == null) {
    const stemp = short?.timeSeries?.[2];
    if (Array.isArray(stemp?.timeDefines)) {
      const a = stemp.areas?.[0];
      let mn: number | null = null;
      let mx: number | null = null;
      stemp.timeDefines.forEach((t: unknown, idx: number) => {
        if (dateOf(t) !== date) return;
        const v = toTemp(a?.temps?.[idx]);
        if (v == null) return;
        mn = mn == null ? v : Math.min(mn, v);
        mx = mx == null ? v : Math.max(mx, v);
      });
      low = mn;
      high = mx;
    }
  }

  label = label.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
  return { date, high, low, label };
}

async function fetchJmaJson(name: string): Promise<unknown> {
  const code = resolveAreaCode(name);
  if (!code) throw new Error('気象庁エリアを特定できませんでした');
  const r = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${code}.json`);
  if (!r.ok) throw new Error(`気象庁API応答エラー (HTTP ${r.status})`);
  return r.json();
}

// ---- Open-Meteo ----

/** WMO weather code を日本語ラベルへ(アイコン判定 icons.ts と整合) */
export function wmoToLabel(code: number | null | undefined): string {
  if (code == null) return '';
  if (code === 0) return '快晴';
  if (code === 1) return '晴れ';
  if (code === 2) return 'くもり時々晴れ';
  if (code === 3) return 'くもり';
  if (code === 45 || code === 48) return '霧';
  if (code >= 51 && code <= 57) return '霧雨';
  if (code >= 61 && code <= 67) return '雨';
  if (code >= 71 && code <= 77) return '雪';
  if (code === 80 || code === 81 || code === 82) return 'にわか雨';
  if (code === 85 || code === 86) return 'にわか雪';
  if (code >= 95) return '雷雨';
  return 'くもり';
}

/** Open-Meteo の daily レスポンスを DayForecast[] へ変換 */
export function parseOpenMeteo(json: unknown): DayForecast[] {
  const daily = (json as any)?.daily;
  const times: unknown[] = Array.isArray(daily?.time) ? daily.time : [];
  const codes: unknown[] = Array.isArray(daily?.weather_code) ? daily.weather_code : [];
  const maxes: unknown[] = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : [];
  const mins: unknown[] = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : [];

  return times.map((t, i) => ({
    date: dateOf(t),
    high: toTemp(maxes[i]),
    low: toTemp(mins[i]),
    label: wmoToLabel(codes[i] == null ? null : Number(codes[i])),
  }));
}

async function fetchOpenMeteoDays(name: string): Promise<DayForecast[]> {
  const coords = resolveCoords(name);
  if (!coords) throw new Error('座標を特定できませんでした');
  const [lat, lon] = coords;
  // past_days=1 + forecast_days=2 で 昨日・今日・明日(フォールバック用)を取得
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=Asia%2FTokyo&past_days=1&forecast_days=2`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo応答エラー (HTTP ${r.status})`);
  return parseOpenMeteo(await r.json());
}

// ---- 統合 ----

/**
 * 昨日(Open-Meteo)+ 今日・明日(気象庁)の3日分を取得。
 * 気象庁が失敗した日は Open-Meteo で補完する。
 */
export async function fetchForecast(locationName: string): Promise<Forecast> {
  const yId = jstDateOffset(-1);
  const tId = jstDateOffset(0);
  const mId = jstDateOffset(1);

  const [jmaRes, omRes] = await Promise.allSettled([
    fetchJmaJson(locationName),
    fetchOpenMeteoDays(locationName),
  ]);

  const omDays = omRes.status === 'fulfilled' ? omRes.value : [];
  const omOf = (date: string) => omDays.find((d) => d.date === date) ?? null;

  let today: DayForecast | null = null;
  let tomorrow: DayForecast | null = null;
  if (jmaRes.status === 'fulfilled') {
    today = parseJmaDay(jmaRes.value, tId);
    tomorrow = parseJmaDay(jmaRes.value, mId);
  }

  // 今日・明日が気象庁で取れたか(取れなければ Open-Meteo で補完)
  const jmaTomorrow = hasData(tomorrow);
  if (!hasData(today)) today = omOf(tId);
  if (!hasData(tomorrow)) tomorrow = omOf(mId);

  // 昨日は常に Open-Meteo
  const yesterday = omOf(yId);

  const days = [yesterday, today, tomorrow].filter(hasData);
  if (days.length === 0) {
    const reasons = [jmaRes, omRes]
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason?.message)
      .join(' / ');
    throw new Error(reasons || '予報データが取得できませんでした');
  }

  return {
    days,
    source: jmaTomorrow ? 'jma' : 'open-meteo',
    fetchedAt: Date.now(),
  };
}
