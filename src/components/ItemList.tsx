import { Plus, Minus, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import type { Child, Item } from '../types';
import { ACCENT } from '../constants';

interface Props {
  child: Child;
  items: Item[];
  isHot: boolean;
  isCool: boolean;
  onChangeItem: (key: string, delta: number) => void;
  onReset: (id: string) => void;
  onToggleConfirm: () => void;
}

/** 持ち物リスト(標準 + 追加品目・+/-ボタン・袖警告) */
export default function ItemList({
  child,
  items: itemDefs,
  isHot,
  isCool,
  onChangeItem,
  onReset,
  onToggleConfirm,
}: Props) {
  const items = child.items || {};
  const totalCount = Object.values(items).reduce((a, b) => a + b, 0);
  const confirmed = !!child.confirmed;

  return (
    <div className="px-5">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-bold text-stone-700">
          持ち物 <span className="text-stone-400">· {child.name}</span>
        </h2>
        {totalCount > 0 && (
          <button
            onClick={() => onReset(child.id)}
            className="text-xs text-stone-500 flex items-center gap-1 px-2 py-1 active:scale-95"
          >
            <RefreshCw size={12} /> リセット
          </button>
        )}
      </div>

      <div className="space-y-2">
        {itemDefs.map((item) => {
          const count = items[item.key] || 0;
          const warn =
            (item.sleeve === 'long' && isHot && count > 0) ||
            (item.sleeve === 'short' && isCool && count > 0);
          return (
            <div
              key={item.key}
              className={`rounded-2xl border transition-all ${
                count > 0
                  ? warn
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-stone-300 shadow-sm'
                  : 'bg-white/50 border-stone-200'
              }`}
            >
              <div className="flex items-center px-3 py-2.5 gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-all ${
                    count > 0 ? (warn ? 'bg-amber-100' : 'bg-stone-100') : 'bg-stone-100/60'
                  }`}
                >
                  {item.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-bold text-base ${
                      count > 0 ? 'text-stone-800' : 'text-stone-500'
                    }`}
                  >
                    {item.key}
                  </div>
                  {warn && (
                    <div className="text-xs text-amber-700 mt-0.5 flex items-center gap-1 font-medium">
                      <AlertTriangle size={11} />
                      {isHot ? '暑い予報です' : '涼しい予報です'}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onChangeItem(item.key, -1)}
                    disabled={count === 0}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                      count === 0 ? 'bg-stone-100 text-stone-300' : 'bg-stone-100 text-stone-700'
                    }`}
                    aria-label="減らす"
                  >
                    <Minus size={18} />
                  </button>
                  <div
                    className={`w-12 text-center font-black text-2xl ${
                      count > 0 ? 'text-stone-800' : 'text-stone-300'
                    }`}
                  >
                    {count}
                  </div>
                  <button
                    onClick={() => onChangeItem(item.key, 1)}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm active:scale-90 transition-all"
                    style={{ background: ACCENT }}
                    aria-label="増やす"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 確定ボタン(確定/取り消しをトグル) */}
      <button
        onClick={onToggleConfirm}
        className={`w-full mt-4 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${
          confirmed
            ? 'bg-white border-2 border-emerald-500 text-emerald-600'
            : 'text-white shadow-sm'
        }`}
        style={confirmed ? {} : { background: '#10B981' }}
      >
        <Check size={22} strokeWidth={3} />
        {confirmed ? `${child.name}の確定を取り消す` : `${child.name}の準備を確定する`}
      </button>
    </div>
  );
}
