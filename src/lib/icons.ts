import { Sun, Cloud, CloudRain, CloudSnow, type LucideIcon } from 'lucide-react';

export type WeatherKind = 'sun' | 'cloud' | 'rain' | 'snow';

const KIND_ICON: Record<WeatherKind, LucideIcon> = {
  sun: Sun,
  cloud: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
};

/** 単一の天気語(セグメント)→ 種別。優先度: 雪 > 雨 > 晴 > くもり */
function kindFromSegment(seg: string): WeatherKind | null {
  if (/雪|みぞれ/.test(seg)) return 'snow';
  if (/雨|雷|しゅう雨|にわか/.test(seg)) return 'rain';
  if (/晴/.test(seg)) return 'sun';
  if (/くもり|曇/.test(seg)) return 'cloud';
  return null;
}

/**
 * 天気テキストを変化順のセグメントに分割する。
 * 気象庁の接続語「のち/後/時々/一時/所により/から」で区切り、
 * 「晴れのち雨」→ ['sun','rain'] のように 1日の中の変化を取り出す。
 */
export function weatherKinds(label?: string | null): WeatherKind[] {
  if (!label) return [];
  const s = String(label).replace(/\s|　/g, '');
  // 接続語で区切る(順序を保持)。「後」は「のち」相当。
  const parts = s.split(/のち|後|時々|一時|所により|から|ときどき/);
  const kinds: WeatherKind[] = [];
  for (const p of parts) {
    const k = kindFromSegment(p);
    if (k && kinds[kinds.length - 1] !== k) kinds.push(k); // 連続重複は除く
  }
  // 分割で取れなければ全体から1つ推定
  if (kinds.length === 0) {
    const k = kindFromSegment(s);
    if (k) kinds.push(k);
  }
  return kinds.slice(0, 3); // 最大3つまで
}

/** 種別 → アイコン */
export function iconForKind(kind: WeatherKind): LucideIcon {
  return KIND_ICON[kind];
}

/** 種別 → 文字色クラス */
export function colorForKind(kind: WeatherKind): string {
  switch (kind) {
    case 'sun':
      return 'text-orange-400';
    case 'snow':
      return 'text-sky-300';
    case 'rain':
      return 'text-blue-400';
    default:
      return 'text-stone-400';
  }
}

/**
 * 天気テキストからアイコンを推定する(単一)。
 * JMAコード(100/200番台)より日本語テキストの正規表現マッチの方が堅牢。
 */
export function iconFromLabel(label?: string | null): LucideIcon {
  const kinds = weatherKinds(label);
  return kinds.length > 0 ? KIND_ICON[kinds[0]] : Cloud;
}
