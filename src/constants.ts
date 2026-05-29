import type { Item } from './types';

// ---- 品目(順序は固定)----
export const ITEMS: Item[] = [
  { key: '着替えおむつセット(長袖)', emoji: '🧺', sleeve: 'long' },
  { key: '着替えおむつセット(半袖)', emoji: '🎁', sleeve: 'short' },
  { key: '長袖', emoji: '🧥', sleeve: 'long' },
  { key: '半袖', emoji: '👕', sleeve: 'short' },
  { key: '長ズボン', emoji: '👖' },
  { key: '半ズボン', emoji: '🩳' },
  { key: '肌着', emoji: '🎽' },
  { key: 'パンツ', emoji: '🩲' },
  { key: '靴下', emoji: '🧦' },
  { key: '前掛け', emoji: '🍽️' },
  { key: '手拭きタオル', emoji: '✋' },
  { key: 'フェイスタオル', emoji: '🧖' },
  { key: 'おむつ', emoji: '👶' },
];

// よく使う地域候補
export const COMMON_LOCATIONS = [
  '東京都', '神奈川県', '千葉県', '埼玉県', '大阪府', '京都府',
  '兵庫県', '愛知県', '福岡県', '北海道', '宮城県', '広島県', '沖縄県',
];

export const STORAGE_KEY = 'hoiku-prep-v1';
export const DEFAULT_THRESHOLD = 23; // 袖の警告基準温度(°C)
export const ACCENT = '#D86B4A'; // メインカラー
export const BG = '#FAF5EA'; // 背景色
