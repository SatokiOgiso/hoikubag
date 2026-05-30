import { useState } from 'react';
import { Plus, Minus, RefreshCw, AlertTriangle, Check, Copy } from 'lucide-react';
import type { Child, Item } from '../types';
import { getBag } from '../types';
import { ACCENT } from '../constants';
import { jstDateOffset, jstWeekday, jstWeekdayNum } from '../lib/date';

interface Props {
  child: Child;
  date: string;
  items: Item[];
  isHot: boolean;
  isCool: boolean;
  closedWeekdays: number[];
  onChangeItem: (date: string, key: string, delta: number) => void;
  onReset: (date: string, id: string) => void;
  onToggleConfirm: (date: string) => void;
  onCopyBag: (childId: string, fromDate: string, toDates: string[]) => void;
}

function shortDateLabel(d: string): string {
  const [, mm, dd] = d.split('-');
  return `${Number(mm)}/${Number(dd)}(${jstWeekday(d)})`;
}

/** 持ち物リスト(標準 + 追加品目・+/-ボタン・袖警告・選択日) */
export default function ItemList({
  child,
  date,
  items: itemDefs,
  isHot,
  isCool,
  closedWeekdays,
  onChangeItem,
  onReset,
  onToggleConfirm,
  onCopyBag,
}: Props) {
  const [showCopy, setShowCopy] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);

  const bag = getBag(child, date);
  const items = bag.items;
  const totalCount = Object.values(items).reduce((a, b) => a + b, 0);
  const confirmed = !!bag.confirmed;

  const copyDates = Array.from({ length: 9 }, (_, i) => jstDateOffset(i - 1)).filter(
    (d) => d !== date
  );

  const toggleCopyTarget = (d: string) => {
    setCopyTargets((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  return (
    <div className="px-5">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-bold text-stone-700">
          持ち物 <span className="text-stone-400">· {child.name}</span>
        </h2>
        {totalCount > 0 && (
          <button
            onClick={() => onReset(date, child.id)}
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
                    onClick={() => onChangeItem(date, item.key, -1)}
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
                    onClick={() => onChangeItem(date, item.key, 1)}
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

      {/* 確定ボタン */}
      <button
        onClick={() => onToggleConfirm(date)}
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

      {/* 他の日にコピー */}
      <div className="mt-3 mb-8">
        <button
          onClick={() => {
            setShowCopy((v) => !v);
            if (showCopy) setCopyTargets([]);
          }}
          className="w-full py-2.5 rounded-xl border border-stone-200 bg-white text-stone-500 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          <Copy size={14} />
          他の日にコピー
          <span className="text-xs opacity-60">{showCopy ? '▴' : '▾'}</span>
        </button>

        {showCopy && (
          <div className="mt-2 p-3 rounded-xl bg-stone-50 border border-stone-200">
            <div className="text-[11px] text-stone-500 mb-2 font-bold">コピー先の日付を選択</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {copyDates.map((d) => {
                const wday = jstWeekdayNum(d);
                const isClosed = closedWeekdays.includes(wday);
                const isSelected = copyTargets.includes(d);
                const isSun = wday === 0;
                const isSat = wday === 6;
                return (
                  <button
                    key={d}
                    onClick={() => toggleCopyTarget(d)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                      isSelected
                        ? isSun
                          ? 'bg-red-500 text-white'
                          : isSat
                          ? 'bg-blue-500 text-white'
                          : 'bg-stone-700 text-white'
                        : isClosed
                        ? isSun
                          ? 'bg-red-50 text-red-300 border border-red-100'
                          : isSat
                          ? 'bg-blue-50 text-blue-300 border border-blue-100'
                          : 'bg-stone-100 text-stone-300 border border-stone-200'
                        : isSun
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : isSat
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'bg-white text-stone-600 border border-stone-200'
                    }`}
                  >
                    {shortDateLabel(d)}
                  </button>
                );
              })}
            </div>
            {copyTargets.length > 0 && (
              <button
                onClick={() => {
                  onCopyBag(child.id, date, copyTargets);
                  setCopyTargets([]);
                  setShowCopy(false);
                }}
                className="w-full py-2.5 rounded-xl bg-stone-700 text-white text-sm font-bold active:scale-95 transition-all"
              >
                {copyTargets.length}日にコピーする
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
