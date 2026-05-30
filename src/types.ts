export type ChildId = string; // uid

export interface Child {
  id: ChildId;
  name: string; // 例: "太郎"
  items: Record<string, number>; // 翌日の入力。例: { "おむつ": 3 }
  defaults: Record<string, number>; // リセット時の初期値。例: { "おむつ": 3, "肌着": 1 }
  confirmed?: boolean; // 翌日の準備を確定したか
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
  updatedAt: number; // 競合解決用タイムスタンプ
}

/** 持ち物の品目定義 */
export interface Item {
  key: string;
  emoji: string;
  sleeve?: 'long' | 'short';
}
