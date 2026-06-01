import { useState, useEffect } from 'react';
import { Plus, Minus, RefreshCw, AlertTriangle, Check, Copy, Lock, X, Users, MessageSquare } from 'lucide-react';
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
  onChangeItemNote: (date: string, key: string, note: string) => void;
  onChangeDayMemo: (date: string, memo: string) => void;
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
  onChangeItemNote,
  onChangeDayMemo,
  showToast,
}: Props) {
  const [showCopy, setShowCopy] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [confirmResetChild, setConfirmResetChild] = useState(false);
  // 直近に増減した品目キー(数量表示を一瞬パルスさせるフィードバック用)
  const [pulseKey, setPulseKey] = useState<string | null>(null);

  const effectiveCounts = effectiveItems(child, date, closedWeekdays);
  const recKeys = recurringKeys(child, date);
  const totalCount = Object.values(effectiveCounts).reduce((a, b) => a + b, 0);
  const confirmed = !!(child.bags?.[date]?.confirmed);

  const [localNotes, setLocalNotes] = useState<string[]>(() => child.bags?.[date]?.notes ?? []);
  const [localItemNotes, setLocalItemNotes] = useState<Record<string, string>>(
    () => child.bags?.[date]?.itemNotes ?? {}
  );
  const [openItemNote, setOpenItemNote] = useState<string | null>(null);
  const [localDayMemo, setLocalDayMemo] = useState<string>(() => child.bags?.[date]?.dayMemo ?? '');
  useEffect(() => {
    setLocalNotes(child.bags?.[date]?.notes ?? []);
    setLocalItemNotes(child.bags?.[date]?.itemNotes ?? {});
    setLocalDayMemo(child.bags?.[date]?.dayMemo ?? '');
    setOpenItemNote(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, child.id]);

  const updateItemNote = (key: string, value: string) => {
    setLocalItemNotes((prev) => ({ ...prev, [key]: value }));
    onChangeItemNote(date, key, value);
  };
  const updateDayMemo = (value: string) => {
    setLocalDayMemo(value);
    onChangeDayMemo(date, value);
  };

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

  // 数量を増減しつつ、その品目の数量表示を一瞬パルスさせる
  const bumpItem = (key: string, delta: number, base: number) => {
    onChangeItem(date, key, delta, base);
    setPulseKey(key);
    setTimeout(() => setPulseKey((k) => (k === key ? null : k)), 300);
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
              onClick={() => setConfirmResetChild(true)}
              className="text-xs text-stone-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:text-red-600 active:scale-95 transition-all"
            >
              <RefreshCw size={14} /> リセット
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
                  {(!confirmed && warn) || (!confirmed && isRecurring && count > 0) ? (
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {!confirmed && warn && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          <AlertTriangle size={13} />
                          {isHot ? '暑い予報です' : '涼しい予報です'}
                        </span>
                      )}
                      {!confirmed && isRecurring && count > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                          🔁 定期
                        </span>
                      )}
                    </div>
                  ) : null}
                  {/* 品目メモ(確定済みでも内容は見える) */}
                  {(localItemNotes[item.key]?.trim() || openItemNote === item.key) && (
                    <div className="text-xs text-blue-700 mt-1 flex items-start gap-1 bg-blue-50 rounded-lg px-2 py-1">
                      <MessageSquare size={13} className="mt-0.5 shrink-0 text-blue-500" />
                      <span className="break-words">{localItemNotes[item.key]}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!confirmed && (
                    <button
                      onClick={() => setOpenItemNote((k) => (k === item.key ? null : item.key))}
                      className={`w-11 h-11 mr-3 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                        localItemNotes[item.key]?.trim()
                          ? 'bg-stone-200 text-stone-600'
                          : 'bg-stone-100 text-stone-400'
                      }`}
                      aria-label="この品目にメモ"
                    >
                      <MessageSquare size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => bumpItem(item.key, -1, count)}
                    disabled={confirmed || count === 0}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                      confirmed || count === 0
                        ? 'bg-stone-100 text-stone-300'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                    aria-label="減らす"
                  >
                    <Minus size={20} />
                  </button>
                  <div
                    aria-live="polite"
                    className={`w-12 text-center font-black text-2xl transition-transform duration-150 ${
                      pulseKey === item.key ? 'scale-125' : 'scale-100'
                    } ${
                      confirmed ? 'text-stone-300' : count > 0 ? 'text-stone-800' : 'text-stone-300'
                    }`}
                  >
                    {count}
                  </div>
                  <button
                    onClick={() => bumpItem(item.key, 1, count)}
                    disabled={confirmed}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm active:scale-90 transition-all disabled:opacity-30"
                    style={{ background: ACCENT }}
                    aria-label="増やす"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
              {/* 品目メモ入力欄(開いている時・未確定) */}
              {!confirmed && openItemNote === item.key && (
                <div className="px-3 pb-2.5 -mt-1">
                  <input
                    type="text"
                    autoFocus
                    value={localItemNotes[item.key] ?? ''}
                    onChange={(e) => updateItemNote(item.key, e.target.value)}
                    onBlur={() => {
                      if (!localItemNotes[item.key]?.trim()) setOpenItemNote(null);
                    }}
                    placeholder="例: 遠足で多めに、汚れた分の替え など"
                    className="w-full text-sm bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 outline-none focus:border-stone-400 text-stone-700"
                  />
                </div>
              )}
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
                  className="w-11 h-11 rounded-xl flex items-center justify-center bg-stone-100 text-stone-400 active:bg-red-100 active:text-red-500 active:scale-90 transition-all shrink-0"
                  aria-label={note.trim() ? `「${note.trim()}」を削除` : 'メモを削除'}
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

      {/* その日全体のメモ */}
      <div className="mt-4">
        <label htmlFor="day-memo" className="text-xs font-bold text-stone-500 mb-1.5 flex items-center gap-1.5">
          <MessageSquare size={13} /> この日のメモ
        </label>
        <textarea
          id="day-memo"
          value={localDayMemo}
          onChange={(e) => updateDayMemo(e.target.value)}
          readOnly={confirmed}
          rows={2}
          placeholder="例: お昼寝布団を持ち帰り、水筒は大きいもの など"
          className={`w-full text-sm rounded-2xl px-3.5 py-3 border outline-none resize-y transition-all ${
            confirmed
              ? 'bg-stone-50 border-stone-200 text-stone-500'
              : 'bg-white border-stone-200 focus:border-stone-400 text-stone-700'
          }`}
        />
      </div>

      {/* 確定ボタン */}
      <button
        onClick={() => {
          onToggleConfirm(date);
          showToast(confirmed ? '確定を取り消しました' : `${child.name}の準備を確定しました`);
        }}
        className={`w-full mt-4 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${
          confirmed
            ? 'bg-white border-2 border-emerald-500 text-emerald-600 ring-2 ring-emerald-200'
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

    {confirmResetChild && (
      <ConfirmDialog
        title="リストをリセットしますか?"
        message={`${shortDateLabel(date)}の${child.name}の準備リストがデフォルトに戻ります。`}
        confirmLabel="リセットする"
        destructive
        onConfirm={() => {
          onReset(date, child.id);
          setConfirmResetChild(false);
        }}
        onCancel={() => setConfirmResetChild(false)}
      />
    )}

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
