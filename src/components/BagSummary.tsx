import { Check, Clock, MessageSquare } from 'lucide-react';
import type { AppState, Item } from '../types';
import { getBag } from '../types';
import { dateLabel, relativeEditedAt } from '../lib/date';
import { effectiveItems } from '../lib/recurring';

interface Props {
  state: AppState;
  items: Item[];
  date: string;
  onSelectChild: (id: string) => void;
}

/** かばんサマリー(選択日・全員分・子ども切り替え兼用) */
export default function BagSummary({ state, items, date, onSelectChild }: Props) {
  return (
    <div className="px-5 mb-4">
      <div className="rounded-2xl bg-white border border-stone-200 p-4 shadow-sm">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[15px] text-stone-500 tracking-[0.3em] font-bold">
            🎒 かばんの中身
          </div>
          <div className="text-[18px] text-stone-500 font-bold">{dateLabel(date)}</div>
        </div>

        <div className="flex flex-col gap-1.5">
          {state.children.map((c) => {
            const bag = getBag(c, date);
            const cItems = effectiveItems(c, date, state.closedWeekdays);
            const cTotal = Object.values(cItems).reduce((a, b) => a + b, 0);
            const cNotes = (bag.notes ?? []).filter((n) => n.trim().length > 0);
            const dayMemo = bag.dayMemo?.trim() ?? '';
            // サマリーに出す品目: 数量がある品目 + 数量0でもメモが付いた品目
            const shownItems = items.filter(
              (i) => cItems[i.key] || bag.itemNotes?.[i.key]?.trim()
            );
            const active = c.id === state.currentChildId;
            const confirmed = !!bag.confirmed;
            const editedLabel = relativeEditedAt(c.itemsUpdatedAt);
            return (
              <button
                key={c.id}
                onClick={() => onSelectChild(c.id)}
                className={`flex w-full text-left gap-3 rounded-xl px-3 py-2.5 transition-transform active:scale-[0.98] ${
                  active
                    ? 'bg-stone-800 text-white shadow-sm'
                    : 'text-stone-400 hover:bg-stone-50'
                }`}
              >
                {/* 確定マーク */}
                <div
                  className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center transition-all ${
                    confirmed
                      ? 'bg-emerald-500'
                      : active
                      ? 'bg-red-400/20 border-2 border-dashed border-red-300/50'
                      : 'bg-red-50 border-2 border-dashed border-red-200'
                  }`}
                  aria-label={confirmed ? '確定済み' : '未確定'}
                >
                  {confirmed && <Check size={22} strokeWidth={3} className="text-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: active ? 'rgba(255,255,255,0.6)' : '#A8A29E' }}
                      />
                      <div className="font-bold text-[21px]">{c.name}</div>
                      {confirmed ? (
                        <span
                          className={`text-[15px] font-bold ${
                            active ? 'text-emerald-400' : 'text-emerald-600'
                          }`}
                        >
                          確定済み
                        </span>
                      ) : (
                        <span
                          className={`text-[15px] font-bold ${
                            active ? 'text-red-300' : 'text-red-400'
                          }`}
                        >
                          未確定・入力中
                        </span>
                      )}
                    </div>
                    <div className="text-[18px] font-bold">
                      {cTotal > 0 ? (
                        <span>
                          {cTotal}
                          <span
                            className={`ml-0.5 ${active ? 'text-white/50' : 'text-stone-400'}`}
                          >
                            点
                          </span>
                        </span>
                      ) : cNotes.length > 0 ? (
                        <span className={active ? 'text-white/70' : 'text-stone-500'}>
                          メモ{cNotes.length}件
                        </span>
                      ) : (
                        <span className={active ? 'text-white/40' : 'text-stone-400'}>
                          未入力
                        </span>
                      )}
                    </div>
                  </div>
                  {(shownItems.length > 0 || cNotes.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {shownItems.map((i) => {
                        const note = bag.itemNotes?.[i.key]?.trim();
                        const qty = cItems[i.key] || 0;
                        const zeroWithNote = qty === 0; // 数量0でメモのみ → 注意を引く赤表示
                        return (
                          <div
                            key={i.key}
                            className={`px-2.5 py-1 rounded text-[16px] font-medium flex items-center gap-1.5 ${
                              zeroWithNote
                                ? active
                                  ? 'bg-red-400/20'
                                  : 'bg-red-50'
                                : active
                                ? 'bg-white/10'
                                : 'bg-stone-100'
                            }`}
                          >
                            <span className="text-[18px] leading-none">{i.emoji}</span>
                            <span className={zeroWithNote ? (active ? 'text-red-300' : 'text-red-500') : ''}>
                              {i.key}
                            </span>
                            <span
                              className={`font-black ${
                                zeroWithNote ? (active ? 'text-red-300' : 'text-red-500') : ''
                              }`}
                            >
                              {qty}
                            </span>
                            {note && (
                              <span
                                className={`ml-0.5 flex items-center gap-0.5 text-[13px] font-normal ${
                                  zeroWithNote
                                    ? active
                                      ? 'text-red-300'
                                      : 'text-red-500'
                                    : active
                                    ? 'text-white/60'
                                    : 'text-stone-500'
                                }`}
                              >
                                <MessageSquare size={11} className="shrink-0" />
                                {note}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {cNotes.map((n, i) => (
                        <div
                          key={`note-${i}`}
                          className={`px-2.5 py-1 rounded text-[16px] font-medium flex items-center gap-1.5 ${
                            active ? 'bg-white/10' : 'bg-stone-100'
                          }`}
                        >
                          <span className="text-[18px] leading-none">📝</span>
                          <span className="max-w-[108px] truncate">{n}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {dayMemo && (
                    <div
                      className={`mt-1.5 text-[16px] flex items-start gap-1.5 ${
                        active ? 'text-white/70' : 'text-stone-600'
                      }`}
                    >
                      <MessageSquare size={15} className="mt-1 shrink-0" />
                      <span className="break-words">{dayMemo}</span>
                    </div>
                  )}
                  {editedLabel && (
                    <div
                      className={`flex items-center gap-1 mt-1.5 text-[11px] ${
                        active ? 'text-white/40' : 'text-stone-400'
                      }`}
                    >
                      <Clock size={10} />
                      <span>最終編集 {editedLabel}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
