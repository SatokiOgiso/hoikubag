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

/** 気象庁週間予報コード → 日本語ラベル */
const JMA_WEEK_CODES: Record<number, string> = {
  100: '晴れ', 101: '晴れ時々くもり', 102: '晴れ一時雨', 103: '晴れ時々雨',
  104: '晴れ一時雪', 105: '晴れ時々雪', 106: '晴れ一時雨か雪', 107: '晴れ時々雨か雪',
  108: '晴れ一時雨か雷雨', 110: '晴れ後くもり', 111: '晴れ後くもり一時雨',
  112: '晴れ後一時雨', 113: '晴れ後時々雨', 114: '晴れ後雨', 115: '晴れ後一時雪か雨',
  116: '晴れ後雪か雨', 117: '晴れ後雨か雪', 118: '晴れ後雨か雪', 119: '晴れ後くもりか雨',
  120: '晴れ朝夕一時雨', 121: '晴れ朝の内一時雨', 123: '晴れ昼頃から雨',
  124: '晴れ夕方から雨', 125: '晴れ夜は雨', 126: '晴れ昼頃から雨',
  127: '晴れ夕方から雨', 128: '晴れ夜から雨', 130: '朝の内霧後晴れ',
  131: '晴れ明け方霧', 132: '晴れ朝夕くもり', 140: '晴れ時々くもり一時雨',
  160: '晴れ一時雪か雨', 170: '晴れ時々くもり一時雪か雨', 181: '晴れ後雪か雨',
  200: 'くもり', 201: 'くもり時々晴れ', 202: 'くもり一時雨', 203: 'くもり時々雨',
  204: 'くもり一時雪', 205: 'くもり時々雪', 206: 'くもり一時雨か雪',
  207: 'くもり時々雨か雪', 208: 'くもり一時雨か雷雨', 209: '霧',
  210: 'くもり後晴れ', 211: 'くもり後晴れ一時雨', 212: 'くもり後一時雨',
  213: 'くもり後時々雨', 214: 'くもり後雨', 215: 'くもり後雪か雨',
  217: 'くもり後雨か雪', 218: 'くもり後雨か雪', 219: 'くもり後晴れか雨',
  220: 'くもり朝夕一時雨', 221: 'くもり朝の内一時雨', 222: 'くもり夕方一時雨',
  223: 'くもり日中時々晴れ', 224: 'くもり昼頃から雨', 225: 'くもり夕方から雨',
  226: 'くもり夜は雨', 228: 'くもり昼頃から雨', 229: 'くもり夕方から雨',
  230: 'くもり夜から雨', 231: 'くもり海上海岸は霧か霧雨', 240: 'くもり時々雨一時雷雨',
  250: 'くもり時々雪', 260: 'くもり一時雪か雨', 270: 'くもり時々雪か雨',
  281: 'くもり後雪か雨',
  300: '雨', 301: '雨時々晴れ', 302: '雨時々くもり', 303: '雨時々雪',
  304: '雨か雪', 306: '大雨', 308: '雨で暴風を伴う', 309: '雨一時雪',
  311: '雨後晴れ', 313: '雨後くもり', 314: '雨後時々くもり', 315: '雨後雪か雨',
  316: '雨後くもり一時雪', 317: '雨後くもり一時雪', 320: '朝の内雨後晴れ',
  321: '朝の内雨後くもり', 322: '雨朝晩一時雪', 323: '雨昼頃から晴れ',
  324: '雨夕方から晴れ', 325: '雨夜は晴れ', 326: '雨夕方から雪',
  327: '雨夜から雪', 328: '雨一時強く降る', 329: '雨一時みぞれ',
  340: '雪か雨', 350: '雨で雷を伴う', 361: '雪か雨後晴れ', 371: '雪か雨後くもり',
  400: '雪', 401: '雪時々晴れ', 402: '雪時々くもり', 403: '雪時々雨',
  405: '大雪', 406: '風雪強い', 407: '暴風雪', 409: '雪一時雨',
  411: '雪後晴れ', 413: '雪後くもり', 414: '雪後雨', 420: '朝の内雪後晴れ',
  421: '朝の内雪後くもり', 422: '雪昼頃から雨', 423: '雪夕方から雨',
  425: '雪一時強く降る', 426: '雪後みぞれ', 427: '雪一時みぞれ', 450: '雪で雷を伴う',
};

function jmaCodeToLabel(code: string | number | null | undefined): string {
  if (code == null) return '';
  const n = Number(String(code).trim());
  return JMA_WEEK_CODES[n] ?? '';
}

/** 気象庁週間予報 JSON から全日分の予報(天気コード+気温+信頼度)を抽出 */
export function parseJmaWeeklyDays(json: unknown): DayForecast[] {
  const root = (Array.isArray(json) ? json : []) as any[];
  const weekly = root[1];
  if (!weekly) return [];

  const wts0 = weekly.timeSeries?.[0]; // 天気コード + 降水確率 + 信頼度
  const wts1 = weekly.timeSeries?.[1]; // 気温

  if (!wts0 || !Array.isArray(wts0.timeDefines)) return [];

  return (wts0.timeDefines as unknown[]).map((timeStr, i) => {
    const date = dateOf(timeStr);
    const area0 = wts0.areas?.[0];
    const label = jmaCodeToLabel(area0?.weatherCodes?.[i]);
    const rawRel = area0?.reliabilities?.[i];
    const reliability = rawRel && /^[A-C]$/i.test(String(rawRel)) ? String(rawRel).toUpperCase() : null;

    let high: number | null = null;
    let low: number | null = null;

    if (wts1 && Array.isArray(wts1.timeDefines)) {
      const ti = (wts1.timeDefines as unknown[]).findIndex((t) => dateOf(t) === date);
      if (ti >= 0) {
        const area1 = wts1.areas?.[0];
        high = toTemp(area1?.tempsMax?.[ti]);
        low = toTemp(area1?.tempsMin?.[ti]);
      }
    }

    return { date, high, low, label, reliability };
  });
}

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
 * 昨日(Open-Meteo)+ 今日・明日(気象庁短期)+ 明後日〜7日後(気象庁週間)を取得。
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

  // 気象庁を優先しつつ、欠けたフィールド(気温/天気)だけ Open-Meteo で補完する。
  // 夜間は気象庁の当日気温が "" になり気温だけ欠けることがあるため、日まるごとでなく
  // フィールド単位でマージしないと「今日の気温が出ない」状態になる。
  const mergeDay = (date: string, jma: DayForecast | null): DayForecast | null => {
    const om = omOf(date);
    if (!hasData(jma)) return om;
    if (!om) return jma;
    return {
      date,
      high: jma.high ?? om.high,
      low: jma.low ?? om.low,
      label: jma.label || om.label,
      reliability: jma.reliability ?? null,
    };
  };

  let today: DayForecast | null = null;
  let tomorrow: DayForecast | null = null;
  let weeklyDays: DayForecast[] = [];
  if (jmaRes.status === 'fulfilled') {
    today = parseJmaDay(jmaRes.value, tId);
    tomorrow = parseJmaDay(jmaRes.value, mId);
    weeklyDays = parseJmaWeeklyDays(jmaRes.value);
  }

  // 今日・明日: 気象庁を主にしつつ欠けたフィールドを Open-Meteo で補う
  const jmaTomorrow = hasData(tomorrow);
  today = mergeDay(tId, today);
  tomorrow = mergeDay(mId, tomorrow);

  // 昨日は常に Open-Meteo
  const yesterday = omOf(yId);

  // 週間予報から明後日〜7日後を追加
  const futureDays: DayForecast[] = [];
  for (let off = 2; off <= 7; off++) {
    const dateId = jstDateOffset(off);
    const d = weeklyDays.find((w) => w.date === dateId) ?? null;
    if (d && hasData(d)) futureDays.push(d);
  }

  const days = [yesterday, today, tomorrow, ...futureDays].filter(hasData);
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
