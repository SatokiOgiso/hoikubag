import type { Weather } from '../types';

/**
 * 天気自動取得のスタブ。
 *
 * v1 では手動入力のみ。将来 Vercel 移行後に、CSP 制限がなくなるため
 * 以下の実装を復活できる(仕様書 Section 7 参照):
 *   - 推奨: 気象庁オープンデータ直叩き
 *       GET https://www.jma.go.jp/bosai/forecast/data/forecast/{areaCode}.json
 *     - 日付計算は JST で行う(toISOString は UTC 基準で1日ズレる)
 *     - 週間予報(data[1].timeSeries[1].areas[*].tempsMax/Min)を優先
 *     - tempsMax/Min が "" のとき Number("") === 0 のバグに注意
 *   - フォールバック: Open-Meteo(緯度経度ベース、海外都市対応)
 *
 * いまは未配線。呼ばれたら明示的にエラーにする。
 */
export async function fetchWeather(_locationName: string): Promise<Weather> {
  throw new Error('天気の自動取得は未実装です(手動入力をご利用ください)');
}
