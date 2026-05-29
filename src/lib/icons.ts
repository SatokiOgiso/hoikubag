import { Sun, Cloud, CloudRain, CloudSnow, type LucideIcon } from 'lucide-react';

/**
 * 天気テキストからアイコンを推定する。
 * JMAコード(100/200番台)より日本語テキストの正規表現マッチの方が堅牢。
 */
export function iconFromLabel(label?: string | null): LucideIcon {
  if (!label) return Cloud;
  const s = String(label);
  if (/雪/.test(s)) return CloudSnow;
  if (/雨|雷|しゅう雨|にわか/.test(s)) return CloudRain;
  if (/晴/.test(s) && !/くもり|曇/.test(s)) return Sun;
  if (/晴/.test(s)) return Sun; // 晴れ時々くもりなど → 晴れ寄り
  if (/くもり|曇/.test(s)) return Cloud;
  return Cloud;
}
