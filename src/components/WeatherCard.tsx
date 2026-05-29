import { AlertTriangle } from 'lucide-react';
import type { AppState } from '../types';
import { DEFAULT_THRESHOLD } from '../constants';
import { tomorrowLabel } from '../lib/date';
import { iconFromLabel } from '../lib/icons';
import InlineTempInput from './InlineTempInput';

interface Props {
  state: AppState;
  onSetManualWeather: (high: string, low: string, label: string) => void;
  onClearWeather: () => void;
}

/** 天気カード(手動入力・表示・袖警告) */
export default function WeatherCard({ state, onSetManualWeather, onClearWeather }: Props) {
  const tempHigh = state.weather?.high;
  const threshold = state.thresholdTemp ?? DEFAULT_THRESHOLD;
  const hasTemp = tempHigh != null;
  const isHot = hasTemp && tempHigh > threshold;
  const isCool = hasTemp && tempHigh <= threshold;
  const wLabel = state.weather?.label || '';
  const WIcon = iconFromLabel(wLabel);

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
                </div>
              </div>
              <button
                onClick={onClearWeather}
                className="text-xs text-stone-400 underline px-1 active:scale-95"
                aria-label="再入力"
              >
                変更
              </button>
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
              {!isHot && !isCool && hasTemp && (
                <div className="text-xs text-stone-500">
                  基準温度の範囲内です(しきい値 {threshold}°C)
                </div>
              )}
            </div>
          </>
        ) : (
          <div>
            <div className="text-xs text-stone-600 mb-2 leading-relaxed">
              明日の最高/最低気温を入力してください。
              <span className="block text-[10px] text-stone-400 mt-0.5">
                📱 スマホの天気アプリで確認 → 入力 で5秒
              </span>
            </div>
            <InlineTempInput onSubmit={onSetManualWeather} />
          </div>
        )}
      </div>
    </div>
  );
}
