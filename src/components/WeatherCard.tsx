import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { Forecast, DayForecast } from '../types';
import { jstDateOffset, jstWeekday } from '../lib/date';
import { iconFromLabel } from '../lib/icons';

interface Props {
  locationName?: string;
  forecast: Forecast | null;
  threshold: number;
  weatherLoading: boolean;
  weatherError: string | null;
  onFetchWeather: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  jma: '気象庁',
  'open-meteo': 'Open-Meteo',
};

/** 日付(YYYY-MM-DD)→ 「5/31(日)」(JST基準) */
function shortDate(date: string): string {
  const [, mm, dd] = date.split('-');
  return `${Number(mm)}/${Number(dd)}(${jstWeekday(date)})`;
}

/** 相対ラベル(昨日/今日/明日)。それ以外は空 */
function relativeLabel(date: string): string {
  if (date === jstDateOffset(-1)) return '昨日';
  if (date === jstDateOffset(0)) return '今日';
  if (date === jstDateOffset(1)) return '明日';
  return '';
}

function DayCell({ day, threshold }: { day: DayForecast; threshold: number }) {
  const rel = relativeLabel(day.date);
  const isTomorrow = rel === '明日';
  const Icon = iconFromLabel(day.label);
  const hot = day.high != null && day.high > threshold;
  const cool = day.high != null && day.high <= threshold;

  return (
    <div
      className={`flex-1 rounded-2xl px-2 py-3 text-center transition-all ${
        isTomorrow ? 'border-2' : 'border border-stone-100'
      }`}
      style={
        isTomorrow
          ? hot
            ? { background: 'linear-gradient(135deg, #FEEAD2, #FFF6E8)', borderColor: '#F5C99A' }
            : cool
              ? { background: 'linear-gradient(135deg, #DDEDF5, #F0F7FB)', borderColor: '#B5D4E5' }
              : { borderColor: '#D6D3D1' }
          : {}
      }
    >
      <div className={`text-xs font-bold ${isTomorrow ? 'text-stone-800' : 'text-stone-500'}`}>
        {rel || shortDate(day.date)}
      </div>
      <div className="text-[10px] text-stone-400 mb-1">{rel ? shortDate(day.date) : ''}</div>
      <div className="flex justify-center my-1">
        <Icon
          size={30}
          strokeWidth={1.5}
          className={hot ? 'text-orange-500' : cool ? 'text-sky-600' : 'text-stone-500'}
        />
      </div>
      <div className="text-[11px] text-stone-500 truncate" title={day.label}>
        {day.label || '—'}
      </div>
      <div className="mt-1 font-black text-stone-800">
        {day.high != null ? `${day.high}°` : '—'}
      </div>
      <div className="text-xs text-stone-400 font-bold">
        {day.low != null ? `${day.low}°` : '—'}
      </div>
    </div>
  );
}

/** 天気カード(昨日・今日・明日を自動取得して表示) */
export default function WeatherCard({
  locationName,
  forecast,
  threshold,
  weatherLoading,
  weatherError,
  onFetchWeather,
}: Props) {
  // 昨日→今日→明日 の順に並べる
  const order = [jstDateOffset(-1), jstDateOffset(0), jstDateOffset(1)];
  const days = forecast
    ? [...forecast.days].sort((a, b) => order.indexOf(a.date) - order.indexOf(b.date))
    : [];
  const tomorrow = days.find((d) => d.date === jstDateOffset(1)) ?? null;
  const tHigh = tomorrow?.high ?? null;
  const isHot = tHigh != null && tHigh > threshold;
  const isCool = tHigh != null && tHigh <= threshold;
  const sourceLabel = forecast ? (SOURCE_LABEL[forecast.source] ?? '') : '';

  return (
    <div className="px-5 mb-5">
      <div className="rounded-3xl p-5 bg-white border border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-stone-500 font-bold tracking-wider">明日のかばんの目安</div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-stone-500 font-bold">📍 {locationName || '地域未設定'}</div>
            <button
              onClick={onFetchWeather}
              disabled={weatherLoading}
              className="w-8 h-8 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center text-stone-600 active:scale-90 transition-all disabled:opacity-50"
              aria-label="天気を再取得"
            >
              <RefreshCw size={14} className={weatherLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {days.length > 0 ? (
          <>
            <div className="flex gap-2">
              {days.map((d) => (
                <DayCell key={d.date} day={d} threshold={threshold} />
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-stone-200/60">
              {isHot && (
                <div className="flex items-center gap-2 text-orange-700 text-sm font-bold">
                  <AlertTriangle size={15} />
                  明日は暑い予報。<span className="underline">👕半袖</span>がおすすめ
                </div>
              )}
              {isCool && (
                <div className="flex items-center gap-2 text-sky-700 text-sm font-bold">
                  <AlertTriangle size={15} />
                  明日は涼しい予報。<span className="underline">🧥長袖</span>がおすすめ
                </div>
              )}
              {!isHot && !isCool && (
                <div className="text-xs text-stone-500">
                  明日の気温が取得できませんでした(しきい値 {threshold}°C)
                </div>
              )}
              {sourceLabel && (
                <div className="text-[10px] text-stone-400 mt-1">天気: {sourceLabel}</div>
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
              {weatherError || '天気を取得できませんでした'}
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
