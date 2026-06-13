import { ChevronLeft, ChevronRight, Check, MessageSquare, PencilLine } from 'lucide-react';
import type { AppState, Item } from '../types';
import { getBag } from '../types';
import { dateLabel, jstDateOffset, jstWeekdayNum } from '../lib/date';
import { effectiveItems } from '../lib/recurring';
import { DEFAULT_CLOSED_WEEKDAYS } from '../constants';

interface Props {
  state: AppState;
  items: Item[];
  date: string;
  onChangeDate: (date: string) => void;
  /** 通常表示(編集モード)へ切り替える */
  onExit: () => void;
}

const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * 閲覧専用のかんたん表示。用意すべきかばんの中身だけを大きく見せる。
 * 編集 UI を持たず、日付の前後移動(登園日単位)と通常表示への切り替えのみ。
 */
export default function SimpleView({ state, items, date, onChangeDate, onExit }: Props) {
  const closed = state.closedWeekdays ?? DEFAULT_CLOSED_WEEKDAYS;
  const minDate = jstDateOffset(-1);
  const maxDate = jstDateOffset(7);

  // 前後の登園日(休園日はスキップ)。範囲外なら null
  const step = (dir: 1 | -1): string | null => {
    let d = date;
    for (let i = 0; i < 7; i++) {
      d = addDays(d, dir);
      if (d < minDate || d > maxDate) return null;
      if (!closed.includes(jstWeekdayNum(d))) return d;
    }
    return null;
  };
  const prev = step(-1);
  const next = step(1);

  return (
    <div className="relative max-w-lg mx-auto px-5 pt-6 pb-10">
      {/* 日付ナビゲーション */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => prev && onChangeDate(prev)}
          disabled={!prev}
          className="w-12 h-12 rounded-2xl bg-white border border-stone-200 flex items-center justify-center active:scale-95 transition-all disabled:opacity-30"
          aria-label="前の登園日"
        >
          <ChevronLeft size={24} className="text-stone-600" />
        </button>
        <div className="text-center">
          <div className="text-[13px] font-bold text-stone-400 tracking-[0.2em]">🎒 かばんの中身</div>
          <div className="text-[22px] font-black text-stone-800">{dateLabel(date)}</div>
        </div>
        <button
          onClick={() => next && onChangeDate(next)}
          disabled={!next}
          className="w-12 h-12 rounded-2xl bg-white border border-stone-200 flex items-center justify-center active:scale-95 transition-all disabled:opacity-30"
          aria-label="次の登園日"
        >
          <ChevronRight size={24} className="text-stone-600" />
        </button>
      </div>

      {/* 子どもごとのかばん */}
      <div className="space-y-4">
        {state.children.map((c) => {
          const bag = getBag(c, date);
          const cItems = effectiveItems(c, date, closed);
          const cNotes = (bag.notes ?? []).filter((n) => n.trim().length > 0);
          const dayMemo = bag.dayMemo?.trim() ?? '';
          // 数量がある品目 + 数量0でもメモが付いた品目(普段と違う点は見落とさせない)
          const shownItems = items.filter((i) => cItems[i.key] || bag.itemNotes?.[i.key]?.trim());
          const confirmed = !!bag.confirmed;
          const empty = shownItems.length === 0 && cNotes.length === 0 && !dayMemo;

          return (
            <div key={c.id} className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="text-[24px] font-black text-stone-800">{c.name}</div>
                {confirmed && (
                  <span className="flex items-center gap-1 text-[14px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1">
                    <Check size={14} strokeWidth={3} /> 用意ずみ
                  </span>
                )}
              </div>

              {empty ? (
                <div className="text-[17px] text-stone-400 py-2">まだ入力されていません</div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {shownItems.map((i) => {
                    const qty = cItems[i.key] || 0;
                    const note = bag.itemNotes?.[i.key]?.trim();
                    const zeroWithNote = qty === 0; // 数量0でメモのみ → 赤で注意
                    return (
                      <div key={i.key} className="py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-[26px] leading-none w-8 text-center">{i.emoji}</span>
                          <span
                            className={`flex-1 text-[20px] font-bold ${
                              zeroWithNote ? 'text-red-500' : 'text-stone-800'
                            }`}
                          >
                            {i.key}
                          </span>
                          <span
                            className={`text-[24px] font-black ${
                              zeroWithNote ? 'text-red-500' : 'text-stone-800'
                            }`}
                          >
                            {qty}
                            <span className="text-[15px] font-bold text-stone-400 ml-0.5">個</span>
                          </span>
                        </div>
                        {note && (
                          <div
                            className={`flex items-start gap-1.5 mt-1 ml-11 text-[16px] ${
                              zeroWithNote ? 'text-red-500' : 'text-stone-500'
                            }`}
                          >
                            <MessageSquare size={14} className="mt-1 shrink-0" />
                            <span className="break-words">{note}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {cNotes.map((n, i) => (
                    <div key={`note-${i}`} className="py-2.5 flex items-center gap-3">
                      <span className="text-[26px] leading-none w-8 text-center">📝</span>
                      <span className="flex-1 text-[20px] font-bold text-stone-800 break-words">{n}</span>
                    </div>
                  ))}
                </div>
              )}

              {dayMemo && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-[17px] text-amber-900 flex items-start gap-2">
                  <MessageSquare size={16} className="mt-1 shrink-0" />
                  <span className="break-words">{dayMemo}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 通常表示への切り替え(控えめに配置) */}
      <button
        onClick={onExit}
        className="mt-8 mx-auto flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-bold text-stone-400 hover:text-stone-600 active:scale-95 transition-all"
      >
        <PencilLine size={14} /> 通常表示(編集モード)に切り替え
      </button>
    </div>
  );
}
