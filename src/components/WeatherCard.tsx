import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { Forecast } from '../types';
import { jstWeekday } from '../lib/date';
import { iconFromLabel } from '../lib/icons';

interface Props {
  locationName?: string;
  forecast: Forecast | null;
  threshold: number;
  selectedDate: string;
  weatherLoading: boolean;
  weatherError: string | null;
  onFetchWeather: () => void;
}

const SOURCE_NOTE: Record<string, string> = {
  jma: '今日・明日: 気象庁 / 昨日: Open-Meteo',
  'open-meteo': 'Open-Meteo',
};

/** 日付(YYYY-MM-DD)→ 「5/31(日)」(JST基準) */
function shortDate(date: string): string {
  const [, mm, dd] = date.split('-');
  return `${Number(mm)}/${Number(dd)}(${jstWeekday(date)})`;
}

// 気温→色のアンカー(15:緑 → 25:赤オレンジ → 30:赤 → 35:紫)
const TEMP_STOPS: { t: number; c: [number, number, number] }[] = [
  { t: 15, c: [22, 163, 74] }, // 緑
  { t: 25, c: [234, 88, 12] }, // 赤オレンジ
  { t: 30, c: [220, 38, 38] }, // 赤
  { t: 35, c: [147, 51, 234] }, // 紫
];

/** 気温に応じた文字色(アンカー間は線形補間、範囲外はクランプ) */
function tempColor(t: number | null): string {
  if (t == null) return '#A8A29E'; // stone-400
  const first = TEMP_STOPS[0];
  const last = TEMP_STOPS[TEMP_STOPS.length - 1];
  if (t <= first.t) return `rgb(${first.c.join(',')})`;
  if (t >= last.t) return `rgb(${last.c.join(',')})`;
  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const a = TEMP_STOPS[i];
    const b = TEMP_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const r = (t - a.t) / (b.t - a.t);
      const mix = a.c.map((ac, j) => Math.round(ac + (b.c[j] - ac) * r));
      return `rgb(${mix.join(',')})`;
    }
  }
  return '#A8A29E';
}

const fmtTemp = (t: number | null): string => (t != null ? `${t}°` : '—');

/** 天気カード(選択日の予報を表示) */
export default function WeatherCard({
  locationName,
  forecast,
  threshold,
  selectedDate,
  weatherLoading,
  weatherError,
  onFetchWeather,
}: Props) {
  const day = forecast?.days.find((d) => d.date === selectedDate) ?? null;
  const tHigh = day?.high ?? null;
  const isHot = tHigh != null && tHigh > threshold;
  const isCool = tHigh != null && tHigh <= threshold;
  const sourceNote = forecast ? (SOURCE_NOTE[forecast.source] ?? '') : '';
  const Icon = iconFromLabel(day?.label);

  return (
    <div className="px-5 mb-5">
      <div
        className="rounded-3xl p-5 border transition-all"
        style={
          isHot
            ? { background: 'linear-gradient(135deg, #FEEAD2, #FFF6E8)', borderColor: '#F5C99A' }
            : isCool
              ? { background: 'linear-gradient(135deg, #DDEDF5, #F0F7FB)', borderColor: '#B5D4E5' }
              : { background: '#fff', borderColor: '#E7E5E4' }
        }
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-stone-500 font-bold tracking-wider">
            {shortDate(selectedDate)} の天気
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-stone-500 font-bold">📍 {locationName || '地域未設定'}</div>
            <button
              onClick={onFetchWeather}
              disabled={weatherLoading}
              className="w-8 h-8 rounded-lg bg-white/70 border border-stone-200 flex items-center justify-center text-stone-600 active:scale-90 transition-all disabled:opacity-50"
              aria-label="天気を再取得"
            >
              <RefreshCw size={14} className={weatherLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {day ? (
          <>
            <div className="flex items-center gap-4">
              <Icon
                size={56}
                strokeWidth={1.4}
                className={isHot ? 'text-orange-500' : isCool ? 'text-sky-600' : 'text-stone-500'}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-stone-500 font-bold mb-0.5 truncate" title={day.label}>
                  {day.label || '—'}
                </div>
                <div className="text-[10px] text-stone-400 font-bold tracking-wide">最低 / 最高</div>
                <div className="flex items-baseline gap-1.5 font-black leading-none">
                  <span className="text-4xl" style={{ color: tempColor(day.low) }}>
                    {fmtTemp(day.low)}
                  </span>
                  <span className="text-stone-300 text-2xl">/</span>
                  <span className="text-4xl" style={{ color: tempColor(day.high) }}>
                    {fmtTemp(day.high)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-stone-200/60">
              {isHot && (
                <div className="flex items-center gap-2 text-orange-700 text-sm font-bold">
                  <AlertTriangle size={15} />
                  暑い予報。<span className="underline">👕半袖</span>がおすすめ
                </div>
              )}
              {isCool && (
                <div className="flex items-center gap-2 text-sky-700 text-sm font-bold">
                  <AlertTriangle size={15} />
                  涼しい予報。<span className="underline">🧥長袖</span>がおすすめ
                </div>
              )}
              {!isHot && !isCool && (
                <div className="text-xs text-stone-500">
                  この日の気温が取得できませんでした(しきい値 {threshold}°C)
                </div>
              )}
              {sourceNote && (
                <div className="text-[10px] text-stone-400 mt-1">天気: {sourceNote}</div>
              )}
            </div>
          </>
        ) : weatherLoading ? (
          <div className="py-8 text-center text-stone-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin" /> 天気を取得中…
          </div>
        ) : (
          <div className="py-6 text-center">
            <div className="text-sm text-stone-500 mb-2">
              {weatherError || 'この日の天気予報はありません'}
            </div>
            <button
              onClick={onFetchWeather}
              className="text-xs text-stone-600 underline active:scale-95"
            >
              もう一度取得
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
