import { Check } from 'lucide-react';
import type { AppState, Item } from '../types';
import { getBag } from '../types';
import { ACCENT } from '../constants';
import { dateLabel } from '../lib/date';

interface Props {
  state: AppState;
  items: Item[];
  date: string;
  onSelectChild: (id: string) => void;
}

/** かばん(最上部・全員分サマリー・選択日) */
export default function BagSummary({ state, items, date, onSelectChild }: Props) {
  return (
    <div className="px-5 mb-4">
      <div className="rounded-2xl bg-stone-800 text-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[10px] text-stone-400 tracking-[0.3em] font-bold">
            🎒 かばんの中身
          </div>
          <div className="text-xs text-stone-400 font-bold">{dateLabel(date)}</div>
        </div>
        <div>
          {state.children.map((c, idx) => {
            const bag = getBag(c, date);
            const cItems = bag.items;
            const cTotal = Object.values(cItems).reduce((a, b) => a + b, 0);
            const active = c.id === state.currentChildId;
            const confirmed = !!bag.confirmed;
            return (
              <button
                key={c.id}
                onClick={() => onSelectChild(c.id)}
                className={`flex w-full text-left gap-3 transition-opacity ${
                  idx > 0 ? 'mt-3 pt-3 border-t border-white/10' : ''
                } ${active ? 'opacity-100' : 'opacity-70 hover:opacity-90'}`}
              >
                {/* 確定マーク(大きめの緑の四角) */}
                <div
                  className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${
                    confirmed ? 'bg-emerald-500' : 'bg-white/5 border-2 border-dashed border-white/20'
                  }`}
                  aria-label={confirmed ? '確定済み' : '未確定'}
                >
                  {confirmed && <Check size={26} strokeWidth={3} className="text-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${active ? '' : 'bg-stone-500'}`}
                        style={active ? { background: ACCENT } : {}}
                      />
                      <div className="font-bold text-sm">{c.name}</div>
                      {confirmed && (
                        <span className="text-[10px] font-bold text-emerald-400">確定済み</span>
                      )}
                    </div>
                    <div className="text-xs font-bold">
                      {cTotal > 0 ? (
                        <span>
                          {cTotal}
                          <span className="text-stone-400 ml-0.5">点</span>
                        </span>
                      ) : (
                        <span className="text-stone-500">未入力</span>
                      )}
                    </div>
                  </div>
                  {cTotal > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {items.filter((i) => cItems[i.key]).map((i) => (
                        <div
                          key={i.key}
                          className="bg-white/10 px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1"
                        >
                          <span className="text-sm leading-none">{i.emoji}</span>
                          <span>{i.key}</span>
                          <span className="font-black">{cItems[i.key]}</span>
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
