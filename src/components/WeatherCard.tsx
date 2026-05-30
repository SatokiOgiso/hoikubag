import { AlertTriangle, RefreshCw, Cloud } from 'lucide-react';
import type { AppState } from '../types';
import { DEFAULT_THRESHOLD, ACCENT } from '../constants';
import { tomorrowLabel } from '../lib/date';
import { iconFromLabel } from '../lib/icons';
import InlineTempInput from './InlineTempInput';

interface Props {
  state: AppState;
  weatherLoading: boolean;
  weatherError: string | null;
  onFetchWeather: () => void;
  onSetManualWeather: (high: string, low: string, label: string) => void;
  onClearWeather: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  jma: '気象庁',
  'open-meteo': 'Open-Meteo',
  manual: '手動入力',
};

/** 天気カード(自動取得・手動入力・表示・袖警告) */
export default function WeatherCard({
  state,
  weatherLoading,
  weatherError,
  onFetchWeather,
  onSetManualWeather,
  onClearWeather,
}: Props) {
  const tempHigh = state.weather?.high;
  const threshold = state.thresholdTemp ?? DEFAULT_THRESHOLD;
  const hasTemp = tempHigh != null;
  const isHot = hasTemp && tempHigh > threshold;
  const isCool = hasTemp && tempHigh <= threshold;
  const wLabel = state.weather?.label || '';
  const WIcon = iconFromLabel(wLabel);
  const sourceLabel = state.weather ? SOURCE_LABEL[state.weather.source] ?? '' : '';

  return (
    <div className="px-5 mb-5">
      <div
        className={`rounded-3xl p-5 transition-all ${
          isHot || isCool ? 'border' : 'bg-white border border-stone-200'
        }`}
        style={
          isHot
            ? { background: 'linear-gradient(135deg, #FEEAD2, #FFF6E8)', borderColor: '#F5C99A' }
            : isCool
              ? { background: 'linear-gradient(135deg, #DDEDF5, #F0F7FB)', borderColor: '#B5D4E5' }
              : {}
        }
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-stone-500 font-bold tracking-wider">
            明日 · {tomorrowLabel()}
          </div>
          <div className="text-xs text-stone-500 font-bold">
            📍 {state.location?.name || '地域未設定'}
          </div>
        </div>

        {state.weather ? (
          <>
            <div className="flex items-end gap-4">
              <WIcon
                size={52}
                strokeWidth={1.4}
                className={isHot ? 'text-orange-500' : isCool ? 'text-sky-600' : 'text-stone-500'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-stone-800 leading-none">
                    {tempHigh != null ? `${tempHigh}°` : '—'}
                  </span>
                  <span className="text-xl text-stone-400 font-bold">
                    / {state.weather.low != null ? `${state.weather.low}°` : '—'}
                  </span>
                </div>
                <div className="text-sm text-stone-500 mt-1 truncate">
                  {wLabel ? `${wLabel} · ` : ''}
                  {state.location.name}
                  {sourceLabel ? (
                    <span className="text-[10px] text-stone-400 ml-1">({sourceLabel})</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={onFetchWeather}
                  disabled={weatherLoading}
                  className="w-9 h-9 rounded-xl bg-white/70 border border-stone-200 flex items-center justify-center text-stone-600 active:scale-90 transition-all disabled:opacity-50"
                  aria-label="天気を再取得"
                >
                  <RefreshCw size={15} className={weatherLoading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={onClearWeather}
                  className="text-xs text-stone-400 underline px-1 active:scale-95"
                  aria-label="再入力"
                >
                  変更
                </button>
              </div>
            </div>
            {weatherError && (
              <div className="mt-2 text-[10px] text-stone-400 break-all">
                取得エラー: {weatherError}
              </div>
            )}

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
              {!isHot && !isCool && hasTemp && (
                <div className="text-xs text-stone-500">
                  基準温度の範囲内です(しきい値 {threshold}°C)
                </div>
              )}
            </div>
          </>
        ) : (
          <div>
            {/* 自動取得ボタン(気象庁) */}
            <button
              onClick={onFetchWeather}
              disabled={weatherLoading}
              className="w-full py-3 rounded-xl text-white font-bold active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: ACCENT }}
            >
              {weatherLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> 取得中…
                </>
              ) : (
                <>
                  <Cloud size={16} /> 明日の天気を自動取得({state.location?.name || '地域未設定'})
                </>
              )}
            </button>
            {weatherError && (
              <div className="mt-2 text-[11px] text-red-500 break-all">{weatherError}</div>
            )}

            {/* 手動入力(フォールバック) */}
            <div className="mt-3 pt-3 border-t border-stone-200/60">
              <div className="text-[11px] text-stone-500 mb-2 leading-relaxed">
                うまく取得できないときは手動で入力できます。
              </div>
              <InlineTempInput onSubmit={onSetManualWeather} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
