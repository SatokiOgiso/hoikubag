import { useState, useEffect } from 'react';
import { Plus, Minus, RefreshCw, AlertTriangle, Check, Copy, Lock, X, Users } from 'lucide-react';
import type { Child, Item } from '../types';
import { ACCENT } from '../constants';
import { jstDateOffset, jstWeekday, jstWeekdayNum } from '../lib/date';
import { effectiveItems, recurringKeys } from '../lib/recurring';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  child: Child;
  date: string;
  items: Item[];
  isHot: boolean;
  isCool: boolean;
  closedWeekdays: number[];
  childCount: number;
  onChangeItem: (date: string, key: string, delta: number, base?: number) => void;
  onReset: (date: string, id: string) => void;
  onResetAll: (date: string) => void;
  onToggleConfirm: (date: string) => void;
  onCopyBag: (childId: string, fromDate: string, toDates: string[]) => void;
  onChangeNotes: (date: string, notes: string[]) => void;
  showToast: (msg: string, undo?: () => void) => void;
}

function shortDateLabel(d: string): string {
  const [, mm, dd] = d.split('-');
  return `${Number(mm)}/${Number(dd)}(${jstWeekday(d)})`;
}

/** 持ち物リスト(標準 + 追加品目 + その日限りのメモ) */
export default function ItemList({
  child,
  date,
  items: itemDefs,
  isHot,
  isCool,
  closedWeekdays,
  childCount,
  onChangeItem,
  onReset,
  onResetAll,
  onToggleConfirm,
  onCopyBag,
  onChangeNotes,
  showToast,
}: Props) {
  const [showCopy, setShowCopy] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const effectiveCounts = effectiveItems(child, date, closedWeekdays);
  const recKeys = recurringKeys(child, date);
  const totalCount = Object.values(effectiveCounts).reduce((a, b) => a + b, 0);
  const confirmed = !!(child.bags?.[date]?.confirmed);

  const [localNotes, setLocalNotes] = useState<string[]>(() => child.bags?.[date]?.notes ?? []);
  useEffect(() => {
    setLocalNotes(child.bags?.[date]?.notes ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, child.id]);

  const copyDates = Array.from({ length: 9 }, (_, i) => jstDateOffset(i - 1)).filter(
    (d) => d !== date
  );

  const updateNote = (i: number, value: string) => {
    const next = localNotes.map((n, j) => (j === i ? value : n));
    setLocalNotes(next);
    onChangeNotes(date, next);
  };

  const addNote = () => {
    const next = [...localNotes, ''];
    setLocalNotes(next);
    onChangeNotes(date, next);
  };

  const removeNote = (i: number) => {
    const before = localNotes;
    const removed = localNotes[i];
    const next = localNotes.filter((_, j) => j !== i);
    setLocalNotes(next);
    onChangeNotes(date, next);
    // 入力済みのメモを消した時だけ取り消しを提示(空欄の削除は通知不要)
    if (removed.trim()) {
      showToast(`「${removed.trim()}」を削除しました`, () => {
        setLocalNotes(before);
        onChangeNotes(date, before);
        showToast('元に戻しました');
      });
    }
  };

  const toggleCopyTarget = (d: string) => {
    setCopyTargets((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  return (
    <>
    <div className="px-5">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-bold text-stone-700">
          持ち物 <span className="text-stone-400">· {child.name}</span>
        </h2>
        {confirmed ? (
          <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
            <Lock size={11} />
            確定済み・編集不可
          </div>
        ) : (
          totalCount > 0 && (
            <button
              onClick={() => onReset(date, child.id)}
              className="text-xs text-stone-500 flex items-center gap-1 px-2 py-1 active:scale-95"
            >
              <RefreshCw size={12} /> リセット
            </button>
          )
        )}
      </div>

      <div className="space-y-2">
        {/* 通常アイテム */}
        {itemDefs.map((item) => {
          const count = effectiveCounts[item.key] || 0;
          const isRecurring = recKeys.has(item.key);
          const warn =
            (item.sleeve === 'long' && isHot && count > 0) ||
            (item.sleeve === 'short' && isCool && count > 0);
          return (
            <div
              key={item.key}
              className={`rounded-2xl border transition-all ${
                confirmed
                  ? count > 0
                    ? 'bg-stone-50 border-stone-200'
                    : 'bg-white/30 border-stone-100'
                  : count > 0
                  ? warn
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-stone-300 shadow-sm'
                  : 'bg-white/50 border-stone-200'
              }`}
            >
              <div className="flex items-center px-3 py-2.5 gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-all ${
                    confirmed
                      ? 'bg-stone-100/60'
                      : count > 0
                      ? warn
                        ? 'bg-amber-100'
                        : 'bg-stone-100'
                      : 'bg-stone-100/60'
                  }`}
                >
                  {item.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-bold text-base ${
                      confirmed ? 'text-stone-400' : count > 0 ? 'text-stone-800' : 'text-stone-500'
                    }`}
                  >
                    {item.key}
                  </div>
                  {!confirmed && warn && (
                    <div className="text-xs text-amber-700 mt-0.5 flex items-center gap-1 font-medium">
                      <AlertTriangle size={11} />
                      {isHot ? '暑い予報です' : '涼しい予報です'}
                    </div>
                  )}
                  {!confirmed && isRecurring && count > 0 && (
                    <div className="text-[10px] text-stone-400 mt-0.5 font-medium">🔁 定期</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onChangeItem(date, item.key, -1, count)}
                    disabled={confirmed || count === 0}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                      confirmed || count === 0
                        ? 'bg-stone-100 text-stone-300'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                    aria-label="減らす"
                  >
                    <Minus size={18} />
                  </button>
                  <div
                    className={`w-12 text-center font-black text-2xl ${
                      confirmed ? 'text-stone-300' : count > 0 ? 'text-stone-800' : 'text-stone-300'
                    }`}
                  >
                    {count}
                  </div>
                  <button
                    onClick={() => onChangeItem(date, item.key, 1, count)}
                    disabled={confirmed}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm active:scale-90 transition-all disabled:opacity-30"
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

        {/* その日だけの持ち物(テキスト入力行) */}
        {localNotes.map((note, i) => (
          <div
            key={`note-${i}`}
            className={`rounded-2xl border transition-all ${
              confirmed
                ? note.trim()
                  ? 'bg-stone-50 border-stone-200'
                  : 'bg-white/30 border-stone-100'
                : note.trim()
                ? 'bg-white border-stone-300 shadow-sm'
                : 'bg-white/50 border-stone-200'
            }`}
          >
            <div className="flex items-center px-3 py-2.5 gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                  confirmed ? 'bg-stone-100/60' : note.trim() ? 'bg-stone-100' : 'bg-stone-100/60'
                }`}
              >
                📝
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => updateNote(i, e.target.value)}
                readOnly={confirmed}
                placeholder="書類名・持ち物など"
                className={`flex-1 font-bold text-base bg-transparent outline-none min-w-0 ${
                  confirmed
                    ? note.trim()
                      ? 'text-stone-400'
                      : 'text-stone-300'
                    : note.trim()
                    ? 'text-stone-800'
                    : 'placeholder:text-stone-300 text-stone-800'
                }`}
              />
              {!confirmed && (
                <button
                  onClick={() => removeNote(i)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-stone-100 text-stone-400 active:scale-90 transition-all shrink-0"
                  aria-label="削除"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* メモ追加ボタン */}
        {!confirmed && (
          <button
            onClick={addNote}
            className="w-full py-3 rounded-2xl border border-dashed border-stone-200 text-stone-400 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Plus size={14} /> その日だけの持ち物を追加
          </button>
        )}
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
      <div className="mt-3">
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

      {/* 家族全員分のリセット(子どもが複数いる時だけ) */}
      {childCount > 1 && (
        <div className="mb-8">
          <button
            onClick={() => setConfirmResetAll(true)}
            className="w-full py-2.5 rounded-xl border border-stone-200 bg-white text-stone-400 text-sm font-bold flex items-center justify-center gap-1.5 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all"
          >
            <Users size={14} />
            全員分をこの日にリセット
          </button>
        </div>
      )}
    </div>

    {confirmResetAll && (
      <ConfirmDialog
        title="全員分をリセットしますか?"
        message={`${shortDateLabel(date)}の全員の準備リストがデフォルトに戻ります。`}
        confirmLabel="リセットする"
        destructive
        onConfirm={() => {
          onResetAll(date);
          setConfirmResetAll(false);
        }}
        onCancel={() => setConfirmResetAll(false)}
      />
    )}
    </>
  );
}
