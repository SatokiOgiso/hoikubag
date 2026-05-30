import { useEffect, useRef } from 'react';
import type { Forecast } from '../types';
import { jstDateOffset, jstWeekday, jstWeekdayNum } from '../lib/date';
import { iconFromLabel } from '../lib/icons';

interface Props {
  selectedDate: string;
  forecast: Forecast | null;
  threshold: number;
  closedWeekdays: number[];
  onSelectDate: (date: string) => void;
}

// 表示する日付の範囲: 昨日 〜 7日後
const DATE_RANGE = Array.from({ length: 9 }, (_, i) => i - 1); // -1..7

function relativeLabel(date: string): string {
  if (date === jstDateOffset(-1)) return '昨日';
  if (date === jstDateOffset(0)) return '今日';
  if (date === jstDateOffset(1)) return '明日';
  return '';
}

// 気温→色(WeatherCard と同じアンカー: 15緑→25赤橙→30赤→35紫)
const TEMP_STOPS: { t: number; c: [number, number, number] }[] = [
  { t: 15, c: [22, 163, 74] },
  { t: 25, c: [234, 88, 12] },
  { t: 30, c: [220, 38, 38] },
  { t: 35, c: [147, 51, 234] },
];
function tempColor(t: number | null): string {
  if (t == null) return '#A8A29E';
  const first = TEMP_STOPS[0];
  const last = TEMP_STOPS[TEMP_STOPS.length - 1];
  if (t <= first.t) return `rgb(${first.c.join(',')})`;
  if (t >= last.t) return `rgb(${last.c.join(',')})`;
  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const a = TEMP_STOPS[i];
    const b = TEMP_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const r = (t - a.t) / (b.t - a.t);
      return `rgb(${a.c.map((ac, j) => Math.round(ac + (b.c[j] - ac) * r)).join(',')})`;
    }
  }
  return '#A8A29E';
}

function weekdayColor(wdNum: number, active: boolean): string {
  if (active) return 'text-white/80';
  if (wdNum === 0) return 'text-red-500'; // 日
  if (wdNum === 6) return 'text-blue-500'; // 土
  return 'text-stone-500';
}

/** 日付ストリップ(最上部・横スクロール・日付選択) */
export default function DateStrip({ selectedDate, forecast, closedWeekdays, onSelectDate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // 選択中の日付が見える位置へスクロール
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selectedDate]);

  const byDate = new Map((forecast?.days ?? []).map((d) => [d.date, d]));

  return (
    <div className="px-5 pt-2 pb-3">
      <div className="text-[10px] tracking-[0.3em] text-stone-400 font-bold mb-2 px-1">日付を選ぶ</div>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 no-scrollbar snap-x"
      >
        {DATE_RANGE.map((off) => {
          const date = jstDateOffset(off);
          const rel = relativeLabel(date);
          const [, mm, dd] = date.split('-');
          const active = date === selectedDate;
          const day = byDate.get(date) ?? null;
          const Icon = day ? iconFromLabel(day.label) : null;
          const wdNum = jstWeekdayNum(date);
          const isClosed = closedWeekdays.includes(wdNum);
          return (
            <button
              key={date}
              ref={active ? selectedRef : undefined}
              onClick={() => onSelectDate(date)}
              className={`shrink-0 w-[68px] snap-center rounded-2xl py-2.5 flex flex-col items-center gap-0.5 transition-all active:scale-95 ${
                active
                  ? 'bg-stone-800 text-white shadow-md'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              <span className={`text-[11px] font-bold ${weekdayColor(wdNum, active)}`}>
                {rel || jstWeekday(date)}
              </span>
              <span className="text-base font-black leading-none">
                {Number(mm)}/{Number(dd)}
              </span>
              {Icon ? (
                <Icon
                  size={20}
                  strokeWidth={1.6}
                  className={active ? 'text-white/90 my-0.5' : 'text-stone-500 my-0.5'}
                />
              ) : (
                <span className="my-0.5 h-5" />
              )}
              {/* 最低/最高(簡潔に) */}
              <span className="flex items-baseline gap-0.5 font-black leading-none">
                <span
                  className="text-[11px]"
                  style={{ color: active ? 'rgba(255,255,255,0.7)' : tempColor(day?.low ?? null) }}
                >
                  {day?.low != null ? `${day.low}°` : '—'}
                </span>
                <span className={active ? 'text-white/40 text-[10px]' : 'text-stone-300 text-[10px]'}>
                  /
                </span>
                <span
                  className="text-[12px]"
                  style={{ color: active ? '#fff' : tempColor(day?.high ?? null) }}
                >
                  {day?.high != null ? `${day.high}°` : '—'}
                </span>
              </span>
              {/* 下段バッジ: 休日 > 予報精度 > 空スペース */}
              {isClosed ? (
                <span
                  className={`text-[10px] font-black leading-none px-1.5 py-0.5 rounded-md ${
                    active ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-400'
                  }`}
                >
                  休
                </span>
              ) : day?.reliability ? (
                <span
                  className={`text-[10px] font-black leading-none px-1 py-0.5 rounded-md ${
                    active
                      ? 'bg-white/20 text-white'
                      : day.reliability === 'A'
                      ? 'bg-emerald-100 text-emerald-700'
                      : day.reliability === 'B'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {day.reliability}
                </span>
              ) : (
                <span className="h-[18px]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
