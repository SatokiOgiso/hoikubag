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

const DATE_RANGE = Array.from({ length: 9 }, (_, i) => i - 1);

function relativeLabel(date: string): string {
  if (date === jstDateOffset(-1)) return '昨日';
  if (date === jstDateOffset(0)) return '今日';
  if (date === jstDateOffset(1)) return '明日';
  return '';
}

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

function weekdayColor(wdNum: number): string {
  if (wdNum === 0) return 'text-red-500';
  if (wdNum === 6) return 'text-blue-500';
  return 'text-stone-500';
}

function weatherIconClass(label: string | undefined): string {
  if (!label) return 'text-stone-400';
  if (label.includes('晴')) return 'text-orange-400';
  if (label.includes('雪')) return 'text-sky-300';
  if (label.includes('雨')) return 'text-blue-400';
  return 'text-stone-400';
}

/** 日付ストリップ(最上部・横スクロール・日付選択) */
export default function DateStrip({ selectedDate, forecast, threshold, closedWeekdays, onSelectDate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selectedDate]);

  const byDate = new Map((forecast?.days ?? []).map((d) => [d.date, d]));

  return (
    <div className="px-5 pt-2 pb-3">
      <div className="text-[15px] tracking-[0.3em] text-stone-400 font-bold mb-2 px-1">日付を選ぶ</div>
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
          const isHot = day?.high != null && day.high > threshold;
          const isCool = day?.high != null && day.high <= threshold;
          return (
            <button
              key={date}
              ref={active ? selectedRef : undefined}
              onClick={() => onSelectDate(date)}
              className={`shrink-0 w-[96px] snap-center rounded-2xl py-3.5 flex flex-col items-center gap-1 transition-all active:scale-95 border ${
                active ? 'shadow-sm' : 'bg-white text-stone-600 border-stone-200'
              }`}
              style={active ? { background: 'linear-gradient(160deg, #FEF0DC, #FFF6E8)', borderColor: '#F5C99A' } : undefined}
            >
              <span className={`text-[16px] font-bold ${weekdayColor(wdNum)}`}>
                {rel || jstWeekday(date)}
              </span>
              <span className="text-[22px] font-black leading-none text-stone-800">
                {Number(mm)}/{Number(dd)}
              </span>
              {Icon ? (
                <Icon
                  size={28}
                  strokeWidth={1.6}
                  className={`my-0.5 ${weatherIconClass(day?.label)}`}
                />
              ) : (
                <span className="my-0.5 h-7" />
              )}
              <span className="flex items-baseline gap-0.5 font-black leading-none">
                <span className="text-[17px]" style={{ color: tempColor(day?.low ?? null) }}>
                  {day?.low != null ? `${day.low}°` : '—'}
                </span>
                <span className="text-stone-300 text-[14px]">/</span>
                <span className="text-[17px]" style={{ color: tempColor(day?.high ?? null) }}>
                  {day?.high != null ? `${day.high}°` : '—'}
                </span>
              </span>
              {isClosed ? (
                <span className={`text-[14px] font-black leading-none px-2 py-0.5 rounded-md ${active ? 'bg-orange-200/60 text-orange-700' : 'bg-stone-100 text-stone-400'}`}>
                  休
                </span>
              ) : (isHot || isCool) ? (
                <span className={`text-[14px] font-black leading-none px-2 py-0.5 rounded-md ${
                  isHot
                    ? active ? 'bg-orange-200/60 text-orange-600' : 'bg-orange-50 text-orange-500'
                    : active ? 'bg-sky-200/60 text-sky-600' : 'bg-sky-50 text-sky-500'
                }`}>
                  {isHot ? '半袖' : '長袖'}
                </span>
              ) : (
                <span className="h-[26px]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
