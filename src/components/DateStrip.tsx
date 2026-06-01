import { useEffect, useRef, useState, useCallback } from 'react';
import type { Forecast } from '../types';
import { jstDateOffset, jstWeekday, jstWeekdayNum, nextDaycareDay } from '../lib/date';
import { weatherKinds, iconForKind, colorForKind } from '../lib/icons';

interface Props {
  selectedDate: string;
  forecast: Forecast | null;
  threshold: number;
  closedWeekdays: number[];
  onSelectDate: (date: string) => void;
}

const INITIAL_MAX = 30;
const LOAD_MORE = 14;

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

/** 日付ストリップ(最上部・横スクロール・日付選択) */
export default function DateStrip({ selectedDate, forecast, threshold, closedWeekdays, onSelectDate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [maxOffset, setMaxOffset] = useState(INITIAL_MAX);

  // 末尾に近づいたら日付を追加
  const loadMore = useCallback(() => setMaxOffset((prev) => prev + LOAD_MORE), []);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { root: scrollRef.current, rootMargin: '0px 200px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selectedDate]);

  const dateRange = Array.from({ length: maxOffset + 2 }, (_, i) => i - 1); // -1 .. maxOffset
  const byDate = new Map((forecast?.days ?? []).map((d) => [d.date, d]));

  const goToNextDaycareDay = () => {
    const next = nextDaycareDay(closedWeekdays, 1);
    onSelectDate(next);
    // 再レンダー後に selectedRef が更新されてからスクロール
    requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
  };

  return (
    <div className="px-5 pt-2 pb-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-[15px] tracking-[0.3em] text-stone-400 font-bold">日付を選ぶ</div>
        <button
          onClick={goToNextDaycareDay}
          className="text-[13px] font-bold text-stone-500 bg-white border border-stone-200 rounded-xl px-3 py-1 active:scale-95 transition-all"
        >
          次の登園日
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 no-scrollbar snap-x"
      >
        {dateRange.map((off) => {
          const date = jstDateOffset(off);
          const rel = relativeLabel(date);
          const [, mm, dd] = date.split('-');
          const active = date === selectedDate;
          const day = byDate.get(date) ?? null;
          const kinds = day ? weatherKinds(day.label) : [];
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
              {kinds.length > 0 ? (
                <span className="my-0.5 h-7 flex items-center justify-center gap-0.5">
                  {kinds.map((k, idx) => {
                    const Ic = iconForKind(k);
                    const single = kinds.length === 1;
                    return (
                      <span key={idx} className="flex items-center gap-0.5">
                        {idx > 0 && (
                          <span className="text-stone-300 text-[11px] leading-none">›</span>
                        )}
                        <Ic
                          size={single ? 28 : 19}
                          strokeWidth={1.6}
                          className={colorForKind(k)}
                        />
                      </span>
                    );
                  })}
                </span>
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
              {/* 予報の信頼度(週間予報の A/B/C)。短期予報の日には付かない */}
              {day?.reliability && (
                <span
                  className={`text-[10px] font-black leading-none px-1.5 py-0.5 rounded ${
                    active
                      ? 'bg-white/25 text-stone-700'
                      : day.reliability === 'A'
                      ? 'bg-emerald-100 text-emerald-700'
                      : day.reliability === 'B'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                  title={`予報信頼度 ${day.reliability}(A:高 〜 C:低)`}
                >
                  予報信頼度{day.reliability}
                </span>
              )}
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
        {/* 末尾センチネル: 見えたら日付を追加 */}
        <div ref={sentinelRef} className="shrink-0 w-1" />
      </div>

      {/* 予報の粒度を明示(どの予報区・どの観測所のデータか) */}
      {forecast && (forecast.areaName || forecast.amedasName) && (
        <div className="px-1 mt-1.5 text-[11px] text-stone-400 leading-relaxed">
          {forecast.areaName && (
            <span>
              天気: 気象庁「{forecast.areaName}」予報区
              {forecast.officeName ? `(${forecast.officeName})` : ''}
            </span>
          )}
          {forecast.amedasName && (
            <span>
              {forecast.areaName ? ' / ' : ''}
              気温: アメダス{forecast.amedasName}観測所
            </span>
          )}
        </div>
      )}
    </div>
  );
}
