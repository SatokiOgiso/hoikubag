import type { Weather } from '../types';

/**
 * 天気の自動取得(気象庁オープンデータ)。
 *
 * GET https://www.jma.go.jp/bosai/forecast/data/forecast/{officeCode}.json
 * は `Access-Control-Allow-Origin: *` 付きでブラウザから直接取得できる。
 *
 * 仕様書 Section 7 の注意点に対応:
 *  - 日付計算は JST で行う(UTC基準だと1日ズレる)
 *  - 気温は週間予報(data[1].timeSeries[1] tempsMax/Min)を優先
 *  - tempsMax/Min が "" のとき Number("") === 0 になるバグを回避
 *  - アイコン判定は日本語テキスト(別ファイル icons.ts の iconFromLabel)
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

/** 地域名から気象庁 office コードを解決(完全名で一致 or 含む) */
export function resolveAreaCode(name: string): string | null {
  if (!name) return null;
  const n = name.trim();
  if (JMA_OFFICES[n]) return JMA_OFFICES[n];
  // 「東京都新宿区」のように都道府県名を含む場合に対応(完全名で照合)
  for (const key of Object.keys(JMA_OFFICES)) {
    if (n.includes(key)) return JMA_OFFICES[key];
  }
  return null;
}

/** JST における「明日」の日付(YYYY-MM-DD) */
export function jstTomorrowDate(base: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // JST の暦日を UTC 上で表現して +1 日(タイムゾーンの影響を受けない日付演算)
  const d = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "" / null を弾いて四捨五入した数値、無効なら null */
function toTemp(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const dateOf = (iso: unknown): string => String(iso).slice(0, 10);

export interface ParsedForecast {
  high: number | null;
  low: number | null;
  label: string;
}

/** 気象庁 forecast JSON から指定日(YYYY-MM-DD)の予報を取り出す */
export function parseForecast(json: unknown, date: string): ParsedForecast {
  // 型は緩く扱う(JMA のスキーマは配列ネストが深い)
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

  // 全角空白を整理
  label = label.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
  return { high, low, label };
}

/** 明日の天気を気象庁から取得 */
export async function fetchWeather(locationName: string): Promise<Weather> {
  const code = resolveAreaCode(locationName);
  if (!code) {
    throw new Error('地域から気象庁エリアを特定できませんでした(都道府県名で設定してください)');
  }

  const r = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${code}.json`);
  if (!r.ok) {
    throw new Error(`気象庁API応答エラー (HTTP ${r.status})`);
  }
  const json = await r.json();
  const { high, low, label } = parseForecast(json, jstTomorrowDate());

  if (high == null && low == null && !label) {
    throw new Error('明日の予報データが見つかりませんでした');
  }

  return { high, low, label, source: 'jma', fetchedAt: Date.now() };
}
