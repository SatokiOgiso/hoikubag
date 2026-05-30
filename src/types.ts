export type ChildId = string; // uid

/** 1日分のかばんの中身 */
export interface DayBag {
  items: Record<string, number>; // 入力。例: { "おむつ": 3 }
  confirmed?: boolean; // その日の準備を確定したか
  notes?: string[]; // その日限りのメモ(書類名など)
}

export interface Child {
  id: ChildId;
  name: string; // 例: "太郎"
  bags: Record<string, DayBag>; // 日付(YYYY-MM-DD)ごとのかばん
  defaults: Record<string, number>; // リセット時の初期値。例: { "おむつ": 3, "肌着": 1 }
  // 旧形式(マイグレーション用・読み込み時のみ)
  items?: Record<string, number>;
  confirmed?: boolean;
}

export interface Location {
  name: string; // 例: "東京都"
  // 将来: 緯度経度や気象庁エリアコードを追加可能
}

export type WeatherSource = 'jma' | 'open-meteo';

/** 1日分の予報 */
export interface DayForecast {
  date: string; // YYYY-MM-DD(JST)
  high: number | null; // 最高気温(°C)
  low: number | null; // 最低気温(°C)
  label: string; // 例: "晴れ", "くもり時々雨"
  reliability?: string | null; // 気象庁の予報精度 'A' | 'B' | 'C' | null
}

/** 取得した予報(昨日・今日・明日の3日分など) */
export interface Forecast {
  days: DayForecast[];
  source: WeatherSource;
  fetchedAt: number; // Unix ms
}

export interface AppState {
  children: Child[];
  currentChildId: ChildId;
  location: Location;
  thresholdTemp: number; // デフォルト 23
  customItems: Item[]; // ユーザーが追加した品目(バスタオルなど)
  closedWeekdays: number[]; // 保育園のない曜日 0=日..6=土, デフォルト [0,6]
  updatedAt: number; // 競合解決用タイムスタンプ
}

/** 子どもの指定日のかばん(なければ空)を取得 */
export function getBag(child: Child, date: string): DayBag {
  return child.bags?.[date] ?? { items: {}, confirmed: false };
}

/** 持ち物の品目定義 */
export interface Item {
  key: string;
  emoji: string;
  sleeve?: 'long' | 'short';
}
