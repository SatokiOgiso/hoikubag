import type { AppState, Item } from '../types';
import { ACCENT } from '../constants';
import { tomorrowLabel } from '../lib/date';

interface Props {
  state: AppState;
  items: Item[];
  onSelectChild: (id: string) => void;
}

/** 明日のかばん(最上部・全員分サマリー) */
export default function BagSummary({ state, items, onSelectChild }: Props) {
  return (
    <div className="px-5 mb-4">
      <div className="rounded-2xl bg-stone-800 text-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[10px] text-stone-400 tracking-[0.3em] font-bold">
            🎒 明日のかばん
          </div>
          <div className="text-xs text-stone-400 font-bold">{tomorrowLabel()}</div>
        </div>
        <div>
          {state.children.map((c, idx) => {
            const cItems = c.items || {};
            const cTotal = Object.values(cItems).reduce((a, b) => a + b, 0);
            const active = c.id === state.currentChildId;
            return (
              <button
                key={c.id}
                onClick={() => onSelectChild(c.id)}
                className={`block w-full text-left transition-opacity ${
                  idx > 0 ? 'mt-3 pt-3 border-t border-white/10' : ''
                } ${active ? 'opacity-100' : 'opacity-70 hover:opacity-90'}`}
              >
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${active ? '' : 'bg-stone-500'}`}
                      style={active ? { background: ACCENT } : {}}
                    />
                    <div className="font-bold text-sm">{c.name}</div>
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
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
