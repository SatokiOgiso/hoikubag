export type ChildId = string; // uid

/** 1日分のかばんの中身 */
export interface DayBag {
  items: Record<string, number>; // 入力。例: { "おむつ": 3 }
  confirmed?: boolean; // その日の準備を確定したか
  notes?: string[]; // その日限りのメモ(書類名など)
  itemNotes?: Record<string, string>; // 品目ごとのメモ(普段と違う個数の理由など)
  dayMemo?: string; // その日全体のメモ
}

export type RecurrenceType = 'weekly' | 'monthly';

export type MonthlyPattern =
  | { kind: 'dayOfMonth'; day: number }
  | { kind: 'nthWeekday'; nth: number; weekday: number };

export interface RecurringItem {
  id: string;
  itemKey: string;
  qty: number;
  type: RecurrenceType;
  weekdays?: number[];    // weekly 用(0=日..6=土)
  interval?: number;      // weekly 用: N週ごと(1=毎週、2=隔週…)
  anchorDate?: string;    // interval>1 の基準日(YYYY-MM-DD)
  monthlyPattern?: MonthlyPattern;
  startDate?: string;     // 開始日(YYYY-MM-DD)。この日より前は適用しない
}

export interface Child {
  id: ChildId;
  name: string; // 例: "太郎"
  bags: Record<string, DayBag>; // 日付(YYYY-MM-DD)ごとのかばん
  defaults: Record<string, number>; // リセット時の初期値。例: { "おむつ": 3, "肌着": 1 }
  recurringItems?: RecurringItem[];
  itemsUpdatedAt?: number; // 持ち物(かばん/メモ)を最後に編集した日時(Unix ms)
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
  /** 天気予報の予報区名(気象庁 class10。例: "東京地方")。粒度の明示に使う */
  areaName?: string | null;
  /** 府県予報区名(気象庁 office。例: "東京都") */
  officeName?: string | null;
  /** 気温の実測に使ったアメダス観測所名(例: "東京") */
  amedasName?: string | null;
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
