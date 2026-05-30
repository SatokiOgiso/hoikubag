import { useState } from 'react';
import { X, Plus, Minus, Trash2, RefreshCw, Copy, Check, Users, AlertTriangle } from 'lucide-react';
import type { AppState, Item, RecurringItem, RecurrenceType } from '../types';
import type { SyncStatus } from '../hooks/useAppState';
import { COMMON_LOCATIONS, ACCENT, DEFAULT_THRESHOLD, DEFAULT_CLOSED_WEEKDAYS, ITEM_EMOJI_CHOICES } from '../constants';
import { shareUrlFor } from '../lib/storage';
import { jstDateOffset } from '../lib/date';
import { ruleLabel } from '../lib/recurring';
import ConfirmDialog, { type ConfirmOptions } from './ConfirmDialog';

interface Props {
  state: AppState;
  items: Item[];
  familyId: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  selectedDate: string;
  fontScale: number;
  onFontScale: (v: number) => void;
  onClose: () => void;
  actions: {
    addChild: () => void;
    renameChild: (id: string, name: string) => void;
    removeChild: (id: string) => void;
    selectChild: (id: string) => void;
    changeDefault: (key: string, delta: number) => void;
    saveCurrentAsDefault: (date: string) => void;
    setLocation: (name: string) => void;
    setThreshold: (n: number) => void;
    setClosedWeekdays: (days: number[]) => void;
    resetAll: (date: string) => void;
    addCustomItem: (name: string, emoji: string) => boolean;
    removeCustomItem: (key: string) => void;
    addRecurringItem: (childId: string, rule: Omit<RecurringItem, 'id'>) => boolean;
    removeRecurringItem: (childId: string, ruleId: string) => void;
    enableSharing: () => void;
    joinFamily: (input: string) => Promise<boolean>;
    disableSharing: () => void;
    syncNow: () => void;
  };
}

/** 設定モーダル(下から立ち上がる/デスクトップは中央) */
export default function SettingsModal({
  state,
  items,
  familyId,
  syncStatus,
  syncError,
  selectedDate,
  fontScale,
  onFontScale,
  onClose,
  actions,
}: Props) {
  const [citySearch, setCitySearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemEmoji, setNewItemEmoji] = useState(ITEM_EMOJI_CHOICES[0]);
  const [joinInput, setJoinInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const currentChild = state.children.find((c) => c.id === state.currentChildId);

  // 確認ダイアログ: 開く時に内容と実行内容(onConfirm)をまとめて保持する
  const [confirm, setConfirm] = useState<(ConfirmOptions & { onConfirm: () => void }) | null>(null);
  const askConfirm = (opts: ConfirmOptions, onConfirm: () => void) =>
    setConfirm({ ...opts, onConfirm });

  // 定期的な持ち物フォーム用 state
  const [recChildId, setRecChildId] = useState(state.currentChildId);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [recItemKey, setRecItemKey] = useState('');
  const [recQty, setRecQty] = useState(1);
  const [recType, setRecType] = useState<RecurrenceType>('weekly');
  const [recInterval, setRecInterval] = useState(1);
  const [recWeekdays, setRecWeekdays] = useState<number[]>([]);
  const [recMonthlyKind, setRecMonthlyKind] = useState<'dayOfMonth' | 'nthWeekday'>('dayOfMonth');
  const [recMonthlyDay, setRecMonthlyDay] = useState(1);
  const [recMonthlyNth, setRecMonthlyNth] = useState(1);
  const [recMonthlyWeekday, setRecMonthlyWeekday] = useState(1);
  const [recStartDate, setRecStartDate] = useState('');

  const recChild = state.children.find((c) => c.id === recChildId) ?? state.children[0];

  const resetRecurringForm = () => {
    setRecItemKey('');
    setRecQty(1);
    setRecType('weekly');
    setRecInterval(1);
    setRecWeekdays([]);
    setRecMonthlyKind('dayOfMonth');
    setRecMonthlyDay(1);
    setRecMonthlyNth(1);
    setRecMonthlyWeekday(1);
    setRecStartDate('');
  };

  const handleAddRecurring = () => {
    const rule: Omit<RecurringItem, 'id'> =
      recType === 'weekly'
        ? {
            itemKey: recItemKey,
            qty: recQty,
            type: 'weekly',
            weekdays: recWeekdays,
            interval: recInterval,
            ...(recInterval > 1 ? { anchorDate: recStartDate || jstDateOffset(0) } : {}),
            ...(recStartDate ? { startDate: recStartDate } : {}),
          }
        : {
            itemKey: recItemKey,
            qty: recQty,
            type: 'monthly',
            monthlyPattern:
              recMonthlyKind === 'dayOfMonth'
                ? { kind: 'dayOfMonth', day: recMonthlyDay }
                : { kind: 'nthWeekday', nth: recMonthlyNth, weekday: recMonthlyWeekday },
            ...(recStartDate ? { startDate: recStartDate } : {}),
          };
    if (actions.addRecurringItem(recChildId, rule)) {
      setShowAddRecurring(false);
      resetRecurringForm();
    }
  };

  const addItem = () => {
    if (actions.addCustomItem(newItemName, newItemEmoji)) {
      setNewItemName('');
      setNewItemEmoji(ITEM_EMOJI_CHOICES[0]);
    }
  };

  const shareUrl = familyId ? shareUrlFor(familyId) : '';
  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* クリップボード不可環境では手動コピーにフォールバック */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const commitCity = () => {
    if (!citySearch.trim()) return;
    actions.setLocation(citySearch.trim());
    setCitySearch('');
  };

  return (
    <>
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div
        className="bg-stone-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col"
        style={{ maxHeight: '92dvh' }}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-stone-200 shrink-0 bg-stone-50 rounded-t-3xl">
          <h2 className="text-xl font-black text-stone-800">設定</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center active:scale-95"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className="overflow-y-auto overscroll-contain p-5 space-y-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* 子ども管理 */}
          <section>
            <h3 className="text-sm font-bold text-stone-700 mb-2">子ども</h3>
            <div className="space-y-2">
              {state.children.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 bg-white rounded-xl p-2 border border-stone-200"
                >
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => actions.renameChild(c.id, e.target.value)}
                    className="flex-1 bg-transparent px-2 py-1.5 font-bold text-stone-800 focus:outline-none"
                  />
                  <button
                    onClick={() =>
                      askConfirm(
                        {
                          title: `「${c.name}」を削除しますか?`,
                          message: 'この子どもの準備リスト・デフォルト・定期的な持ち物がすべて削除されます。',
                          confirmLabel: '削除する',
                          destructive: true,
                        },
                        () => actions.removeChild(c.id)
                      )
                    }
                    disabled={state.children.length <= 1}
                    className="w-9 h-9 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center disabled:opacity-30"
                    aria-label="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={actions.addChild}
                className="w-full bg-white rounded-xl py-3 border-2 border-dashed border-stone-300 text-stone-600 font-bold active:scale-95 transition-all"
              >
                + 子どもを追加
              </button>
            </div>
          </section>

          {/* 持ち物の種類(追加・削除) */}
          <section>
            <h3 className="text-sm font-bold text-stone-700 mb-2">持ち物の種類</h3>
            <div className="text-xs text-stone-500 mb-2 leading-relaxed">
              リストにない持ち物(バスタオルなど)を追加できます。全員のリストに表示されます。
            </div>

            {/* 追加した品目の一覧(削除可) */}
            {state.customItems.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 mb-2">
                {state.customItems.map((item) => (
                  <div key={item.key} className="flex items-center gap-2 px-3 py-2">
                    <div className="text-xl w-7 text-center">{item.emoji}</div>
                    <div className="flex-1 text-sm font-bold text-stone-700">{item.key}</div>
                    <button
                      onClick={() =>
                        askConfirm(
                          {
                            title: `「${item.key}」を削除しますか?`,
                            message: '全員のリストと、入力済みの各日付からこの品目が取り除かれます。',
                            confirmLabel: '削除する',
                            destructive: true,
                          },
                          () => actions.removeCustomItem(item.key)
                        )
                      }
                      className="w-9 h-9 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center"
                      aria-label={`${item.key}を削除`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 新規追加フォーム */}
            <div className="bg-white rounded-xl border border-stone-200 p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addItem();
                  }}
                  placeholder="例: バスタオル"
                  className="flex-1 min-w-0 bg-stone-50 rounded-lg px-3 py-2 border border-stone-200 text-sm text-stone-800 focus:outline-none focus:border-stone-400"
                />
                <button
                  onClick={addItem}
                  disabled={!newItemName.trim()}
                  className={`shrink-0 px-3 rounded-lg text-white font-bold text-sm active:scale-95 flex items-center gap-1 ${
                    newItemName.trim() ? '' : 'bg-stone-300'
                  }`}
                  style={newItemName.trim() ? { background: ACCENT } : {}}
                >
                  <Plus size={15} /> 追加
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {ITEM_EMOJI_CHOICES.map((e) => (
                  <button
                    key={e}
                    onClick={() => setNewItemEmoji(e)}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center active:scale-90 transition-all ${
                      newItemEmoji === e
                        ? 'bg-stone-800 ring-2 ring-stone-800'
                        : 'bg-stone-100'
                    }`}
                    aria-label={`絵文字 ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* デフォルトの持ち物 */}
          <section>
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-sm font-bold text-stone-700">デフォルトの持ち物</h3>
            </div>
            <div className="text-xs text-stone-500 mb-2 leading-relaxed">
              リセット時に読み込まれる初期値です。子どもごとに設定できます。
            </div>

            {/* 子ども切り替えタブ */}
            <div className="flex gap-1.5 mb-2 overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
              {state.children.map((c) => {
                const active = c.id === state.currentChildId;
                const dTotal = Object.values(c.defaults || {}).reduce((a, b) => a + b, 0);
                return (
                  <button
                    key={c.id}
                    onClick={() => actions.selectChild(c.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                      active ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 border border-stone-200'
                    }`}
                  >
                    <span>{c.name}</span>
                    {dTotal > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          active ? 'bg-white/20' : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {dTotal}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => actions.saveCurrentAsDefault(selectedDate)}
              className="w-full bg-white rounded-xl py-2.5 mb-2 border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 active:scale-95 transition-all"
            >
              📥 {currentChild?.name}の現在の入力をデフォルトに保存
            </button>

            {/* 品目編集リスト */}
            <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
              {items.map((item) => {
                const dCount = (currentChild?.defaults || {})[item.key] || 0;
                return (
                  <div key={item.key} className="flex items-center gap-2 px-3 py-2">
                    <div className="text-xl w-7 text-center">{item.emoji}</div>
                    <div className="flex-1 text-sm font-bold text-stone-700">{item.key}</div>
                    <button
                      onClick={() => actions.changeDefault(item.key, -1)}
                      disabled={dCount === 0}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all ${
                        dCount === 0 ? 'bg-stone-100 text-stone-300' : 'bg-stone-100 text-stone-700'
                      }`}
                      aria-label="減らす"
                    >
                      <Minus size={14} />
                    </button>
                    <div
                      className={`w-7 text-center font-black text-lg ${
                        dCount > 0 ? 'text-stone-800' : 'text-stone-300'
                      }`}
                    >
                      {dCount}
                    </div>
                    <button
                      onClick={() => actions.changeDefault(item.key, 1)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white active:scale-90 transition-all"
                      style={{ background: ACCENT }}
                      aria-label="増やす"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 定期的な持ち物 */}
          <section>
            <h3 className="text-sm font-bold text-stone-700 mb-1">定期的な持ち物</h3>
            <div className="text-xs text-stone-500 mb-2 leading-relaxed">
              毎週・隔週・毎月など、決まった日に持っていく物を登録します。
            </div>

            {/* 子ども切り替えタブ */}
            {state.children.length > 1 && (
              <div className="flex gap-1.5 mb-2 overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
                {state.children.map((c) => {
                  const active = c.id === recChildId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setRecChildId(c.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                        active
                          ? 'bg-stone-800 text-white'
                          : 'bg-white text-stone-600 border border-stone-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 登録済みルール一覧 */}
            {(recChild.recurringItems ?? []).length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 mb-2">
                {(recChild.recurringItems ?? []).map((rule) => (
                  <div key={rule.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="flex-1 text-sm font-bold text-stone-700 leading-snug">
                      {ruleLabel(rule, items)}
                    </div>
                    <button
                      onClick={() => actions.removeRecurringItem(recChildId, rule.id)}
                      className="w-9 h-9 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0"
                      aria-label="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 追加フォーム */}
            {!showAddRecurring ? (
              <button
                onClick={() => setShowAddRecurring(true)}
                className="w-full bg-white rounded-xl py-3 border-2 border-dashed border-stone-300 text-stone-600 font-bold active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                <Plus size={15} /> 定期的な持ち物を追加
              </button>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 p-3 space-y-3">
                {/* 品目入力 */}
                <div>
                  <div className="text-[11px] font-bold text-stone-500 mb-1.5">品目名</div>
                  <input
                    type="text"
                    value={recItemKey}
                    onChange={(e) => setRecItemKey(e.target.value)}
                    placeholder="例: 絵本バッグ、体操着"
                    className="w-full bg-stone-50 rounded-lg px-3 py-2 border border-stone-200 text-sm text-stone-800 focus:outline-none focus:border-stone-400"
                  />
                </div>

                {/* 個数 */}
                <div>
                  <div className="text-[11px] font-bold text-stone-500 mb-1.5">個数</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRecQty((v) => Math.max(1, v - 1))}
                      disabled={recQty <= 1}
                      className="w-9 h-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center active:scale-90 disabled:opacity-30"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="w-8 text-center font-black text-lg text-stone-800">{recQty}</div>
                    <button
                      onClick={() => setRecQty((v) => v + 1)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white active:scale-90"
                      style={{ background: ACCENT }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* 繰り返し種別 */}
                <div>
                  <div className="text-[11px] font-bold text-stone-500 mb-1.5">繰り返し</div>
                  <div className="flex gap-1.5">
                    {(['weekly', 'monthly'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setRecType(t)}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                          recType === t
                            ? 'bg-stone-800 text-white'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {t === 'weekly' ? '週ごと' : '毎月'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 週ごと設定 */}
                {recType === 'weekly' && (
                  <>
                    <div>
                      <div className="text-[11px] font-bold text-stone-500 mb-1.5">N週ごと</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRecInterval((v) => Math.max(1, v - 1))}
                          disabled={recInterval <= 1}
                          className="w-9 h-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center active:scale-90 disabled:opacity-30"
                        >
                          <Minus size={14} />
                        </button>
                        <div className="text-center font-black text-base text-stone-800 w-24">
                          {recInterval === 1 ? '毎週' : recInterval === 2 ? '隔週' : `${recInterval}週ごと`}
                        </div>
                        <button
                          onClick={() => setRecInterval((v) => Math.min(8, v + 1))}
                          disabled={recInterval >= 8}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white active:scale-90 disabled:opacity-30"
                          style={{ background: ACCENT }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-stone-500 mb-1.5">曜日</div>
                      <div className="flex gap-1">
                        {(['日', '月', '火', '水', '木', '金', '土'] as const).map((label, wdNum) => {
                          const isOn = recWeekdays.includes(wdNum);
                          const isSun = wdNum === 0;
                          const isSat = wdNum === 6;
                          return (
                            <button
                              key={wdNum}
                              onClick={() =>
                                setRecWeekdays((prev) =>
                                  isOn ? prev.filter((d) => d !== wdNum) : [...prev, wdNum].sort((a, b) => a - b)
                                )
                              }
                              className={`flex-1 py-2 rounded-xl text-sm font-black transition-all active:scale-95 ${
                                isOn
                                  ? isSun
                                    ? 'bg-red-500 text-white'
                                    : isSat
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-stone-700 text-white'
                                  : isSun
                                  ? 'bg-red-50 text-red-400 border border-red-200'
                                  : isSat
                                  ? 'bg-blue-50 text-blue-400 border border-blue-200'
                                  : 'bg-stone-100 text-stone-400'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* 毎月設定 */}
                {recType === 'monthly' && (
                  <>
                    <div>
                      <div className="text-[11px] font-bold text-stone-500 mb-1.5">種類</div>
                      <div className="flex gap-1.5">
                        {(['dayOfMonth', 'nthWeekday'] as const).map((k) => (
                          <button
                            key={k}
                            onClick={() => setRecMonthlyKind(k)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                              recMonthlyKind === k
                                ? 'bg-stone-800 text-white'
                                : 'bg-stone-100 text-stone-500'
                            }`}
                          >
                            {k === 'dayOfMonth' ? '毎月○日' : '第n曜日'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {recMonthlyKind === 'dayOfMonth' && (
                      <div>
                        <div className="text-[11px] font-bold text-stone-500 mb-1.5">日にち</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setRecMonthlyDay((v) => Math.max(1, v - 1))}
                            disabled={recMonthlyDay <= 1}
                            className="w-9 h-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center active:scale-90 disabled:opacity-30"
                          >
                            <Minus size={14} />
                          </button>
                          <div className="w-12 text-center font-black text-lg text-stone-800">
                            {recMonthlyDay}日
                          </div>
                          <button
                            onClick={() => setRecMonthlyDay((v) => Math.min(31, v + 1))}
                            disabled={recMonthlyDay >= 31}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white active:scale-90 disabled:opacity-30"
                            style={{ background: ACCENT }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                    {recMonthlyKind === 'nthWeekday' && (
                      <>
                        <div>
                          <div className="text-[11px] font-bold text-stone-500 mb-1.5">第何回目</div>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                onClick={() => setRecMonthlyNth(n)}
                                className={`flex-1 py-2 rounded-xl text-sm font-black transition-all active:scale-95 ${
                                  recMonthlyNth === n
                                    ? 'bg-stone-800 text-white'
                                    : 'bg-stone-100 text-stone-500'
                                }`}
                              >
                                第{n}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-stone-500 mb-1.5">曜日</div>
                          <div className="flex gap-1">
                            {(['日', '月', '火', '水', '木', '金', '土'] as const).map((label, wdNum) => {
                              const isSun = wdNum === 0;
                              const isSat = wdNum === 6;
                              const isOn = recMonthlyWeekday === wdNum;
                              return (
                                <button
                                  key={wdNum}
                                  onClick={() => setRecMonthlyWeekday(wdNum)}
                                  className={`flex-1 py-2 rounded-xl text-sm font-black transition-all active:scale-95 ${
                                    isOn
                                      ? isSun
                                        ? 'bg-red-500 text-white'
                                        : isSat
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-stone-700 text-white'
                                      : isSun
                                      ? 'bg-red-50 text-red-400 border border-red-200'
                                      : isSat
                                      ? 'bg-blue-50 text-blue-400 border border-blue-200'
                                      : 'bg-stone-100 text-stone-400'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* 開始日 */}
                <div>
                  <div className="text-[11px] font-bold text-stone-500 mb-1.5">開始日</div>
                  <input
                    type="date"
                    value={recStartDate}
                    onChange={(e) => setRecStartDate(e.target.value)}
                    className="w-full bg-stone-50 rounded-lg px-3 py-2 border border-stone-200 text-sm text-stone-800 focus:outline-none focus:border-stone-400"
                  />
                  <div className="text-[10px] text-stone-400 mt-1">
                    空欄の場合は今日から適用されます
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      setShowAddRecurring(false);
                      resetRecurringForm();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-500 font-bold text-sm active:scale-95"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleAddRecurring}
                    disabled={
                      !recItemKey ||
                      (recType === 'weekly' && recWeekdays.length === 0)
                    }
                    className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm active:scale-95 disabled:opacity-40"
                    style={{ background: ACCENT }}
                  >
                    追加する
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 地域(表示用) */}
          <section>
            <h3 className="text-sm font-bold text-stone-700 mb-2">地域(表示用)</h3>
            <div className="text-xs text-stone-500 mb-2 leading-relaxed">
              どこの予報を見ているかが分かるように表示するための地域名です。
            </div>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCity();
                }}
                placeholder={state.location.name || '例: 東京都、横浜市など'}
                className="flex-1 bg-white rounded-xl px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-400 text-stone-800"
              />
              <button
                onClick={commitCity}
                className="px-4 rounded-xl text-white font-bold active:scale-95"
                style={{ background: ACCENT }}
              >
                設定
              </button>
            </div>

            <div className="text-[10px] text-stone-500 mb-1 font-bold tracking-wider">
              よく使う地域
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_LOCATIONS.map((name) => (
                <button
                  key={name}
                  onClick={() => actions.setLocation(name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all ${
                    state.location.name === name
                      ? 'bg-stone-800 text-white'
                      : 'bg-white text-stone-600 border border-stone-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </section>

          {/* 保育園のない日 */}
          <section>
            <h3 className="text-sm font-bold text-stone-700 mb-1">保育園のない日</h3>
            <div className="text-xs text-stone-500 mb-2 leading-relaxed">
              選択した曜日は「休」と表示され、次の登園日に自動でジャンプします。
            </div>
            <div className="flex gap-1.5">
              {(['日', '月', '火', '水', '木', '金', '土'] as const).map((label, wdNum) => {
                const closed = state.closedWeekdays ?? DEFAULT_CLOSED_WEEKDAYS;
                const isOn = closed.includes(wdNum);
                const isSun = wdNum === 0;
                const isSat = wdNum === 6;
                return (
                  <button
                    key={wdNum}
                    onClick={() => {
                      const next = isOn
                        ? closed.filter((d) => d !== wdNum)
                        : [...closed, wdNum].sort((a, b) => a - b);
                      actions.setClosedWeekdays(next);
                    }}
                    className={`flex-1 py-2 rounded-xl text-sm font-black transition-all active:scale-95 ${
                      isOn
                        ? isSun
                          ? 'bg-red-500 text-white'
                          : isSat
                          ? 'bg-blue-500 text-white'
                          : 'bg-stone-700 text-white'
                        : isSun
                        ? 'bg-red-50 text-red-400 border border-red-200'
                        : isSat
                        ? 'bg-blue-50 text-blue-400 border border-blue-200'
                        : 'bg-white text-stone-400 border border-stone-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 文字サイズ */}
          <section>
            <h3 className="text-sm font-bold text-stone-700 mb-2">文字サイズ</h3>
            <div className="bg-white rounded-xl p-4 border border-stone-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onFontScale(fontScale - 0.1)}
                  disabled={fontScale <= 0.7}
                  className="w-11 h-11 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
                  aria-label="文字を小さく"
                >
                  <Minus size={18} />
                </button>
                <div className="flex-1 text-center">
                  <div className="font-black text-2xl text-stone-800">{Math.round(fontScale * 100)}%</div>
                  <div className="text-xs text-stone-400 mt-0.5">70% 〜 150%</div>
                </div>
                <button
                  onClick={() => onFontScale(fontScale + 0.1)}
                  disabled={fontScale >= 1.5}
                  className="w-11 h-11 rounded-xl text-white flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
                  style={{ background: ACCENT }}
                  aria-label="文字を大きく"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </section>

          {/* しきい値 */}
          <section>
            <h3 className="text-sm font-bold text-stone-700 mb-2">袖の警告基準温度</h3>
            <div className="bg-white rounded-xl p-4 border border-stone-200">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={state.thresholdTemp}
                  onChange={(e) =>
                    actions.setThreshold(Number(e.target.value) || DEFAULT_THRESHOLD)
                  }
                  className="w-20 text-center text-2xl font-black bg-stone-100 rounded-lg py-2 text-stone-800 focus:outline-none"
                />
                <div className="flex-1 text-sm text-stone-600 leading-relaxed">
                  最高気温が
                  <br />
                  <span className="font-bold text-stone-800">{state.thresholdTemp}°C</span>
                  より高ければ半袖、以下なら長袖を推奨
                </div>
              </div>
            </div>
          </section>

          {/* 全リセット */}
          <section>
            <button
              onClick={() =>
                askConfirm(
                  {
                    title: '全員分をリセットしますか?',
                    message: `${selectedDate.slice(5).replace('-', '/')}の全員の準備リストがデフォルトに戻ります。`,
                    confirmLabel: 'リセットする',
                    destructive: true,
                  },
                  () => {
                    actions.resetAll(selectedDate);
                    onClose();
                  }
                )
              }
              className="w-full bg-white rounded-xl py-3 border border-stone-200 text-stone-700 font-bold hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all"
            >
              全員分の準備リストをリセット
            </button>
          </section>

          {/* 家族との同期 */}
          <section>
            <h3 className="text-sm font-bold text-stone-700 mb-2">📱 家族とのデータ同期</h3>

            {!familyId ? (
              <div className="space-y-2">
                <div className="bg-white rounded-xl p-4 border border-stone-200 text-xs text-stone-600 leading-relaxed space-y-2">
                  <p>
                    いまは
                    <span className="font-bold text-stone-800">この端末内にのみ保存</span>
                    されています。共有を開始すると、リンクを知っている家族と同じデータを
                    どの端末からでも見られるようになります。
                  </p>
                </div>
                <button
                  onClick={actions.enableSharing}
                  className="w-full rounded-xl py-3 text-white font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
                  style={{ background: ACCENT }}
                >
                  <Users size={16} /> 家族と共有を開始
                </button>
                <div className="bg-white rounded-xl p-4 border border-stone-200 space-y-2">
                  <p className="text-xs font-bold text-stone-700">招待コードで参加</p>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    家族から送られたリンクまたはIDを貼り付けてください。
                    ホーム画面アプリではリンクをタップしても開けないため、こちらから参加できます。
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value)}
                      placeholder="https://... または 招待ID"
                      className="flex-1 min-w-0 bg-stone-50 rounded-xl px-3 py-2.5 border border-stone-200 text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                    <button
                      disabled={joinLoading || !joinInput.trim()}
                      onClick={async () => {
                        setJoinLoading(true);
                        const ok = await actions.joinFamily(joinInput);
                        setJoinLoading(false);
                        if (ok) setJoinInput('');
                      }}
                      className="shrink-0 px-3 rounded-xl text-white font-bold text-sm active:scale-95 disabled:opacity-50 transition-all"
                      style={{ background: ACCENT }}
                    >
                      {joinLoading ? '…' : '参加'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-white rounded-xl p-4 border border-stone-200 text-xs text-stone-600 leading-relaxed space-y-2">
                  <p className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <Users size={14} /> 共有中
                  </p>
                  <p>
                    下のリンクを家族に LINE などで送ってください。同じリンクを開くと、同じ
                    データが表示・編集できます。
                  </p>
                </div>

                {/* クラウド同期の状態 */}
                {syncStatus === 'error' ? (
                  <div className="bg-red-50 rounded-xl p-3 border border-red-200 text-xs text-red-700 leading-relaxed space-y-1">
                    <p className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle size={14} /> クラウドに接続できていません
                    </p>
                    <p className="text-red-600">
                      現在この端末のデータは家族と同期されていません。サーバー
                      (Upstash) が未設定の可能性があります。Vercel の環境変数
                      <span className="font-mono">KV_REST_API_URL</span> /
                      <span className="font-mono"> KV_REST_API_TOKEN</span>
                      を設定して再デプロイしてください。
                    </p>
                    {syncError && (
                      <p className="text-[10px] text-red-400 break-all">詳細: {syncError}</p>
                    )}
                  </div>
                ) : syncStatus === 'ok' ? (
                  <div className="bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-200 text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                    <Check size={14} /> クラウドと同期できています
                  </div>
                ) : null}

                {/* 共有リンク + コピー */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 bg-white rounded-xl px-3 py-2.5 border border-stone-200 text-xs text-stone-700 focus:outline-none"
                  />
                  <button
                    onClick={copyShareUrl}
                    className="shrink-0 px-3 rounded-xl text-white font-bold text-sm active:scale-95 flex items-center gap-1.5"
                    style={{ background: ACCENT }}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? '完了' : 'コピー'}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={actions.syncNow}
                    className="flex-1 bg-white rounded-xl py-2.5 border border-stone-200 text-stone-700 font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} /> 今すぐ同期
                  </button>
                  <button
                    onClick={() =>
                      askConfirm(
                        {
                          title: '共有を停止しますか?',
                          message: 'この端末を家族共有から外します。再参加には招待コードが必要です(共有データ自体は消えません)。',
                          confirmLabel: '停止する',
                        },
                        actions.disableSharing
                      )
                    }
                    className="flex-1 bg-white rounded-xl py-2.5 border border-stone-200 text-stone-500 font-bold text-sm hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all"
                  >
                    共有を停止
                  </button>
                </div>
                <p className="text-[10px] text-stone-400 leading-relaxed px-1">
                  タブ復帰時に自動で最新を取り込みます。同時編集時は後から保存した内容が優先されます。
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>

    {confirm && (
      <ConfirmDialog
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        destructive={confirm.destructive}
        onConfirm={() => {
          confirm.onConfirm();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    )}
    </>
  );
}
