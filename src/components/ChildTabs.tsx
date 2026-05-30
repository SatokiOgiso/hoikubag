import type { Child } from '../types';
import { getBag } from '../types';

interface Props {
  children: Child[];
  currentChildId: string;
  date: string;
  onSelectChild: (id: string) => void;
}

/** 子どもタブ(横スクロール・選択日の点数) */
export default function ChildTabs({ children, currentChildId, date, onSelectChild }: Props) {
  return (
    <div className="px-5 mb-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 no-scrollbar">
        {children.map((c) => {
          const childTotal = Object.values(getBag(c, date).items).reduce((a, b) => a + b, 0);
          const active = c.id === currentChildId;
          return (
            <button
              key={c.id}
              onClick={() => onSelectChild(c.id)}
              className={`shrink-0 px-5 py-2.5 rounded-2xl font-bold transition-all active:scale-95 flex items-center gap-2 ${
                active
                  ? 'bg-stone-800 text-white shadow-md'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              <span>{c.name}</span>
              {childTotal > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    active ? 'bg-white/20' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {childTotal}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
