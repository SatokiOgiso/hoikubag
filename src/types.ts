export type ChildId = string; // uid

/** 1日分のかばんの中身 */
export interface DayBag {
  items: Record<string, number>; // 入力。例: { "おむつ": 3 }
  confirmed?: boolean; // その日の準備を確定したか
  notes?: string[]; // その日限りのメモ(書類名など)
  itemNotes?: Record<string, string>; // 品目ごとのメモ(普段と違う個数の理由など)
  dayMemo?: string; // その日全体のメモ
  updatedAt?: number; // この日の内容を最後に編集した日時(Unix ms)
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

/** 準備リスト(買い物・提出物・やること)のタスク種別 */
export type TaskKind = 'buy' | 'submit' | 'other'; // 買い物 / 提出物 / その他

/** 準備リストの1件(かばんとは別の、買い物・提出物などのタスク) */
export interface PrepTask {
  id: string;
  title: string; // 自由記述のタイトル(必須)
  kind: TaskKind;
  memo?: string; // 詳細メモ
  dueDate?: string; // 期限 YYYY-MM-DD(提出期限/準備期限)
  childIds?: ChildId[]; // 対象の子(タグ)。空=みんな/共通
  assignee?: string; // 手を挙げた人の名前(空=未定)
  assigneeWhen?: string; // 担当者がいつやる予定か(YYYY-MM-DD)
  done?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 書類の分類 */
export type DocCategory = 'request' | 'event' | 'other'; // 依頼書類 / イベント案内 / その他

/** 書類に添付された写真1枚 */
export interface DocImage {
  url: string; // Vercel Blob の公開URL
  pathname: string; // Blob 上のパス(削除に使う)
  width?: number;
  height?: number;
}

/** 保育園からの書類1件(写真+メタ情報) */
export interface DocEntry {
  id: string;
  title: string; // 自由記述のタイトル
  category: DocCategory;
  memo?: string; // 詳細メモ
  date?: string; // 提出期限・イベント日(YYYY-MM-DD)
  images: DocImage[]; // 写真(複数可)
  confirmedBy?: string[]; // 確認した人の名前
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  children: Child[];
  currentChildId: ChildId;
  location: Location;
  thresholdTemp: number; // デフォルト 23
  customItems: Item[]; // ユーザーが追加した品目(バスタオルなど)
  closedWeekdays: number[]; // 保育園のない曜日 0=日..6=土, デフォルト [0,6]
  rolloverMinutes?: number; // 表示の切り替え時刻(0時からの分)。既定 450(=7:30)
  tasks?: PrepTask[]; // 準備リスト(買い物・提出物・やること)。既存ユーザー向けに optional
  docs?: DocEntry[]; // 書類リスト(写真付き)。既存ユーザー向けに optional
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
