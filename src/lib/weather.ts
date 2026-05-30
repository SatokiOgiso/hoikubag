import type { Forecast, DayForecast } from '../types';

/**
 * 天気の自動取得(Open-Meteo)。
 *
 * GET https://api.open-meteo.com/v1/forecast
 *   ?latitude=..&longitude=..
 *   &daily=weather_code,temperature_2m_max,temperature_2m_min
 *   &timezone=Asia/Tokyo&past_days=1&forecast_days=2
 *
 * past_days=1 + forecast_days=2 で「昨日・今日・明日」の3日分が返る。
 * 無料・APIキー不要・CORS 許可済みでブラウザから直接取得できる。
 */

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

/** 地域名から緯度経度を解決(完全名で一致 or 含む) */
export function resolveCoords(name: string): [number, number] | null {
  if (!name) return null;
  const n = name.trim();
  if (PREF_COORDS[n]) return PREF_COORDS[n];
  // 「東京都新宿区」のように都道府県名を含む場合に対応(完全名で照合)
  for (const key of Object.keys(PREF_COORDS)) {
    if (n.includes(key)) return PREF_COORDS[key];
  }
  return null;
}

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

function toTemp(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Open-Meteo の daily レスポンスを Forecast へ変換 */
export function parseOpenMeteo(json: unknown): DayForecast[] {
  const daily = (json as any)?.daily;
  const times: unknown[] = Array.isArray(daily?.time) ? daily.time : [];
  const codes: unknown[] = Array.isArray(daily?.weather_code) ? daily.weather_code : [];
  const maxes: unknown[] = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : [];
  const mins: unknown[] = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : [];

  return times.map((t, i) => ({
    date: String(t).slice(0, 10),
    high: toTemp(maxes[i]),
    low: toTemp(mins[i]),
    label: wmoToLabel(codes[i] == null ? null : Number(codes[i])),
  }));
}

/** 昨日・今日・明日の天気を Open-Meteo から取得 */
export async function fetchForecast(locationName: string): Promise<Forecast> {
  const coords = resolveCoords(locationName);
  if (!coords) {
    throw new Error('地域から座標を特定できませんでした(都道府県名で設定してください)');
  }
  const [lat, lon] = coords;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=Asia%2FTokyo&past_days=1&forecast_days=2`;

  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`天気API応答エラー (HTTP ${r.status})`);
  }
  const days = parseOpenMeteo(await r.json());
  if (days.length === 0) {
    throw new Error('予報データが取得できませんでした');
  }
  return { days, source: 'open-meteo', fetchedAt: Date.now() };
}
