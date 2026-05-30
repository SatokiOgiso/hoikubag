import { Check } from 'lucide-react';
import type { AppState, Item } from '../types';
import { getBag } from '../types';
import { dateLabel } from '../lib/date';

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
          <div className="text-[10px] text-stone-500 tracking-[0.3em] font-bold">
            🎒 かばんの中身
          </div>
          <div className="text-xs text-stone-500 font-bold">{dateLabel(date)}</div>
        </div>

        <div className="flex flex-col gap-1.5">
          {state.children.map((c) => {
            const bag = getBag(c, date);
            const cItems = bag.items;
            const cTotal = Object.values(cItems).reduce((a, b) => a + b, 0);
            const cNotes = (bag.notes ?? []).filter((n) => n.trim().length > 0);
            const active = c.id === state.currentChildId;
            const confirmed = !!bag.confirmed;
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
                      ? 'bg-white/10 border-2 border-dashed border-white/25'
                      : 'bg-stone-100 border-2 border-dashed border-stone-200'
                  }`}
                  aria-label={confirmed ? '確定済み' : '未確定'}
                >
                  {confirmed && <Check size={22} strokeWidth={3} className="text-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: active ? 'rgba(255,255,255,0.6)' : '#A8A29E' }}
                      />
                      <div className="font-bold text-sm">{c.name}</div>
                      {confirmed && (
                        <span
                          className={`text-[10px] font-bold ${
                            active ? 'text-emerald-400' : 'text-emerald-600'
                          }`}
                        >
                          確定済み
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold">
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
                  {(cTotal > 0 || cNotes.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {items
                        .filter((i) => cItems[i.key])
                        .map((i) => (
                          <div
                            key={i.key}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${
                              active ? 'bg-white/10' : 'bg-stone-100'
                            }`}
                          >
                            <span className="text-sm leading-none">{i.emoji}</span>
                            <span>{i.key}</span>
                            <span className="font-black">{cItems[i.key]}</span>
                          </div>
                        ))}
                      {cNotes.map((n, i) => (
                        <div
                          key={`note-${i}`}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${
                            active ? 'bg-white/10' : 'bg-stone-100'
                          }`}
                        >
                          <span className="text-sm leading-none">📝</span>
                          <span className="max-w-[72px] truncate">{n}</span>
                        </div>
                      ))}
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
