import { useState } from 'react';
import { X, Plus, Trash2, Pencil, Hand } from 'lucide-react';
import type { AppState, PrepTask, TaskKind } from '../types';
import { ACCENT } from '../constants';
import {
  taskUrgency,
  dueLabel,
  planLabel,
  sortTasks,
  KIND_LABEL,
  KIND_EMOJI,
} from '../lib/tasks';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  state: AppState;
  myName: string;
  onSetMyName: (name: string) => void;
  showToast: (msg: string, undo?: () => void) => void;
  onClose: () => void;
  actions: {
    addTask: (input: Omit<PrepTask, 'id' | 'createdAt' | 'updatedAt'>) => boolean;
    updateTask: (task: PrepTask) => void;
    removeTask: (id: string) => void;
    toggleTaskDone: (id: string) => void;
    setTaskAssignee: (id: string, name: string) => void;
    setTaskWhen: (id: string, when: string) => void;
    addCustomItem: (name: string, emoji: string) => boolean;
  };
}

const KINDS: TaskKind[] = ['buy', 'submit', 'other'];

interface Draft {
  id: string | null; // null = 新規
  title: string;
  kind: TaskKind;
  dueDate: string;
  childIds: string[];
  memo: string;
}

const emptyDraft = (kind: TaskKind = 'buy'): Draft => ({
  id: null,
  title: '',
  kind,
  dueDate: '',
  childIds: [],
  memo: '',
});

/** 準備リスト(買い物・提出物・やること)のモーダル */
export default function PrepListModal({
  state,
  myName,
  onSetMyName,
  showToast,
  onClose,
  actions,
}: Props) {
  const tasks = state.tasks ?? [];
  const [filter, setFilter] = useState<'all' | TaskKind>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  // 買い物完了時に「かばんの持ち物に追加するか」を尋ねる対象
  const [buyToRegister, setBuyToRegister] = useState<PrepTask | null>(null);
  // 自分の名前が未設定のまま手を挙げようとしたタスク
  const [pendingHand, setPendingHand] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');

  const childName = (id: string) => state.children.find((c) => c.id === id)?.name ?? '';

  const visible = sortTasks(
    filter === 'all' ? tasks : tasks.filter((t) => t.kind === filter)
  );
  const incomplete = visible.filter((t) => !t.done);
  const completed = visible.filter((t) => t.done);

  const openNew = () => setDraft(emptyDraft(filter === 'all' ? 'buy' : filter));
  const openEdit = (t: PrepTask) =>
    setDraft({
      id: t.id,
      title: t.title,
      kind: t.kind,
      dueDate: t.dueDate ?? '',
      childIds: t.childIds ?? [],
      memo: t.memo ?? '',
    });

  const saveDraft = () => {
    if (!draft) return;
    const payload = {
      title: draft.title,
      kind: draft.kind,
      dueDate: draft.dueDate || undefined,
      childIds: draft.childIds.length ? draft.childIds : undefined,
      memo: draft.memo.trim() || undefined,
    };
    if (draft.id) {
      const existing = tasks.find((t) => t.id === draft.id);
      if (existing) actions.updateTask({ ...existing, ...payload });
      setDraft(null);
    } else {
      if (actions.addTask(payload)) setDraft(null);
    }
  };

  const onToggle = (t: PrepTask) => {
    const willComplete = !t.done;
    actions.toggleTaskDone(t.id);
    // 買い物を完了 → かばんの持ち物に登録するか確認
    if (willComplete && t.kind === 'buy') setBuyToRegister(t);
  };

  const raiseHand = (t: PrepTask) => {
    const name = myName.trim();
    if (!name) {
      setNameInput('');
      setPendingHand(t.id);
      return;
    }
    actions.setTaskAssignee(t.id, name);
  };

  const confirmName = () => {
    const name = nameInput.trim();
    if (!name) return;
    onSetMyName(name);
    if (pendingHand) actions.setTaskAssignee(pendingHand, name);
    setPendingHand(null);
  };

  const registerBuyItem = () => {
    if (!buyToRegister) return;
    if (actions.addCustomItem(buyToRegister.title, '📦')) {
      showToast('かばんの持ち物に追加しました(設定やかばん画面で使えます)');
    }
    setBuyToRegister(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#FAF5EA] rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-black text-stone-800">準備リスト</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 active:scale-95"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* 種別フィルタ */}
        <div className="px-5 pb-2 shrink-0 flex gap-2 overflow-x-auto no-scrollbar">
          <FilterChip label="すべて" active={filter === 'all'} onClick={() => setFilter('all')} />
          {KINDS.map((k) => (
            <FilterChip
              key={k}
              label={`${KIND_EMOJI[k]} ${KIND_LABEL[k]}`}
              active={filter === k}
              onClick={() => setFilter(k)}
            />
          ))}
        </div>

        {/* 一覧 */}
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {incomplete.length === 0 && completed.length === 0 && (
            <div className="text-center text-stone-400 text-sm font-medium py-10">
              まだ登録がありません。
              <br />
              下の「追加」から登録できます。
            </div>
          )}

          <div className="space-y-2">
            {incomplete.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                myName={myName}
                childName={childName}
                onToggle={() => onToggle(t)}
                onEdit={() => openEdit(t)}
                onDelete={() => actions.removeTask(t.id)}
                onRaiseHand={() => raiseHand(t)}
                onLowerHand={() => actions.setTaskAssignee(t.id, '')}
                onSetWhen={(w) => actions.setTaskWhen(t.id, w)}
              />
            ))}
          </div>

          {completed.length > 0 && (
            <>
              <div className="text-[12px] font-bold text-stone-400 mt-4 mb-2 px-1">
                完了済み({completed.length})
              </div>
              <div className="space-y-2">
                {completed.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    myName={myName}
                    childName={childName}
                    onToggle={() => onToggle(t)}
                    onEdit={() => openEdit(t)}
                    onDelete={() => actions.removeTask(t.id)}
                    onRaiseHand={() => raiseHand(t)}
                    onLowerHand={() => actions.setTaskAssignee(t.id, '')}
                    onSetWhen={(w) => actions.setTaskWhen(t.id, w)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* フッター: 追加ボタン */}
        <div className="px-5 py-4 border-t border-stone-200/70 shrink-0">
          <button
            onClick={openNew}
            className="w-full py-3.5 rounded-2xl text-white font-black active:scale-95 flex items-center justify-center gap-2"
            style={{ background: ACCENT }}
          >
            <Plus size={20} /> 追加
          </button>
        </div>
      </div>

      {/* 追加 / 編集フォーム */}
      {draft && (
        <TaskForm
          draft={draft}
          setDraft={setDraft}
          children={state.children}
          onSave={saveDraft}
          onCancel={() => setDraft(null)}
        />
      )}

      {/* 買い物完了 → かばんの持ち物に登録するか */}
      {buyToRegister && (
        <ConfirmDialog
          title="かばんの持ち物に追加しますか?"
          message={`「${buyToRegister.title}」を、かばんの持ち物リストに追加できます。\n今後この持ち物を毎日のかばんに登録できるようになります。`}
          confirmLabel="追加する"
          onConfirm={registerBuyItem}
          onCancel={() => setBuyToRegister(null)}
        />
      )}

      {/* 自分の名前の入力(初回の手挙げ時) */}
      {pendingHand && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          onClick={() => setPendingHand(null)}
        >
          <div
            className="w-full max-w-xs bg-white rounded-3xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-stone-800 mb-1">あなたの名前は?</h3>
            <p className="text-sm text-stone-500 mb-3">
              この端末の担当者名として記録します(あとから変更できます)。
            </p>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmName()}
              placeholder="例: ママ / パパ"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold mb-3 outline-none focus:border-stone-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPendingHand(null)}
                className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-600 font-bold active:scale-95"
              >
                キャンセル
              </button>
              <button
                onClick={confirmName}
                className="flex-1 py-3 rounded-2xl text-white font-bold active:scale-95"
                style={{ background: ACCENT }}
              >
                決定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-bold active:scale-95 transition-all border ${
        active ? 'text-white border-transparent' : 'bg-white text-stone-500 border-stone-200'
      }`}
      style={active ? { background: ACCENT } : undefined}
    >
      {label}
    </button>
  );
}

function TaskCard({
  task,
  myName,
  childName,
  onToggle,
  onEdit,
  onDelete,
  onRaiseHand,
  onLowerHand,
  onSetWhen,
}: {
  task: PrepTask;
  myName: string;
  childName: (id: string) => string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRaiseHand: () => void;
  onLowerHand: () => void;
  onSetWhen: (when: string) => void;
}) {
  const urgency = taskUrgency(task);
  const due = dueLabel(task.dueDate);
  const dueColor =
    urgency === 'overdue'
      ? 'bg-red-50 text-red-600'
      : urgency === 'soon'
      ? 'bg-orange-50 text-orange-600'
      : 'bg-stone-100 text-stone-500';
  const isMine = !!myName.trim() && task.assignee === myName.trim();

  return (
    <div className={`rounded-2xl border px-3 py-2.5 ${task.done ? 'bg-stone-100/60 border-stone-200' : 'bg-white border-stone-200'}`}>
      <div className="flex items-start gap-2.5">
        {/* 完了チェック */}
        <button
          onClick={onToggle}
          className={`mt-0.5 w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center active:scale-90 transition-all ${
            task.done ? 'border-transparent text-white' : 'border-stone-300 text-transparent'
          }`}
          style={task.done ? { background: ACCENT } : undefined}
          aria-label={task.done ? '未完了に戻す' : '完了にする'}
        >
          ✓
        </button>

        <div className="flex-1 min-w-0">
          {/* タイトル + 種別 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-stone-400">
              {KIND_EMOJI[task.kind]} {KIND_LABEL[task.kind]}
            </span>
            <span className={`text-[15px] font-bold ${task.done ? 'line-through text-stone-400' : 'text-stone-800'}`}>
              {task.title}
            </span>
          </div>

          {/* バッジ類: 期限 + 子タグ */}
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {due && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${dueColor}`}>{due}</span>
            )}
            {(task.childIds ?? []).map((id) => (
              <span key={id} className="text-[11px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-600">
                {childName(id)}
              </span>
            ))}
            {(!task.childIds || task.childIds.length === 0) && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-400">
                みんな
              </span>
            )}
          </div>

          {/* メモ */}
          {task.memo && (
            <p className="text-[13px] text-stone-500 mt-1.5 whitespace-pre-line leading-relaxed">{task.memo}</p>
          )}

          {/* 担当 + いつやる */}
          {!task.done && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {task.assignee ? (
                <>
                  <span className="text-[12px] font-bold text-stone-600">✋ {task.assignee}</span>
                  {/* いつやる: 自分の担当なら日付を編集、他の人ならバッジ表示 */}
                  {isMine ? (
                    <label
                      className="relative text-[12px] font-bold rounded-full px-2.5 py-1 active:scale-95 cursor-pointer flex items-center gap-1"
                      style={
                        task.assigneeWhen
                          ? { background: 'rgba(216,107,74,0.1)', color: ACCENT }
                          : { background: '#F5F5F4', color: '#78716C' }
                      }
                    >
                      📅 {task.assigneeWhen ? planLabel(task.assigneeWhen) : 'いつやる?'}
                      <input
                        type="date"
                        value={task.assigneeWhen ?? ''}
                        onChange={(e) => onSetWhen(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label="いつやるか"
                      />
                    </label>
                  ) : (
                    task.assigneeWhen && (
                      <span
                        className="text-[12px] font-bold rounded-full px-2.5 py-1"
                        style={{ background: 'rgba(216,107,74,0.1)', color: ACCENT }}
                      >
                        📅 {planLabel(task.assigneeWhen)}
                      </span>
                    )
                  )}
                  {isMine && (
                    <button
                      onClick={onLowerHand}
                      className="text-[12px] font-bold text-stone-400 underline active:scale-95"
                    >
                      手を下ろす
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={onRaiseHand}
                  className="text-[12px] font-bold text-stone-600 bg-stone-100 rounded-full px-3 py-1 active:scale-95 flex items-center gap-1"
                >
                  <Hand size={13} /> 私がやる
                </button>
              )}
            </div>
          )}
        </div>

        {/* 操作 */}
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onEdit} className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 active:scale-90" aria-label="編集">
            <Pencil size={15} />
          </button>
          <button onClick={onDelete} className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 active:scale-90" aria-label="削除">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskForm({
  draft,
  setDraft,
  children,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  children: AppState['children'];
  onSave: () => void;
  onCancel: () => void;
}) {
  const toggleChild = (id: string) => {
    const has = draft.childIds.includes(id);
    setDraft({
      ...draft,
      childIds: has ? draft.childIds.filter((c) => c !== id) : [...draft.childIds, id],
    });
  };
  const dueHelp = draft.kind === 'submit' ? '提出期限' : '準備の期限';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-md bg-[#FAF5EA] rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
          <h2 className="text-lg font-black text-stone-800">{draft.id ? '編集' : '新しい準備'}</h2>
          <button onClick={onCancel} className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 active:scale-95" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
          {/* 種別 */}
          <div>
            <label className="text-[13px] font-bold text-stone-500 mb-1.5 block">種別</label>
            <div className="flex gap-2">
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => setDraft({ ...draft, kind: k })}
                  className={`flex-1 py-2.5 rounded-2xl text-[13px] font-bold active:scale-95 border ${
                    draft.kind === k ? 'text-white border-transparent' : 'bg-white text-stone-500 border-stone-200'
                  }`}
                  style={draft.kind === k ? { background: ACCENT } : undefined}
                >
                  {KIND_EMOJI[k]} {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          {/* タイトル */}
          <div>
            <label className="text-[13px] font-bold text-stone-500 mb-1.5 block">
              {draft.kind === 'buy' ? '買うもの' : draft.kind === 'submit' ? '提出物の名前' : 'やること'}
            </label>
            <input
              autoFocus={!draft.id}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={draft.kind === 'buy' ? '例: 水着' : draft.kind === 'submit' ? '例: 健康診断票' : '例: 名前付け'}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold bg-white outline-none focus:border-stone-400"
            />
          </div>

          {/* 期限 */}
          <div>
            <label className="text-[13px] font-bold text-stone-500 mb-1.5 block">{dueHelp}(任意)</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                className="flex-1 rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold bg-white outline-none focus:border-stone-400"
              />
              {draft.dueDate && (
                <button
                  onClick={() => setDraft({ ...draft, dueDate: '' })}
                  className="text-[13px] font-bold text-stone-400 px-2 active:scale-95"
                >
                  クリア
                </button>
              )}
            </div>
          </div>

          {/* 子タグ */}
          {children.length > 0 && (
            <div>
              <label className="text-[13px] font-bold text-stone-500 mb-1.5 block">
                どの子のもの?(任意・複数可)
              </label>
              <div className="flex gap-2 flex-wrap">
                {children.map((c) => {
                  const on = draft.childIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleChild(c.id)}
                      className={`px-3.5 py-1.5 rounded-full text-[13px] font-bold active:scale-95 border ${
                        on ? 'bg-sky-500 text-white border-transparent' : 'bg-white text-stone-500 border-stone-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-stone-400 mt-1">未選択なら「みんな」になります</p>
            </div>
          )}

          {/* メモ */}
          <div>
            <label className="text-[13px] font-bold text-stone-500 mb-1.5 block">詳細メモ(任意)</label>
            <textarea
              value={draft.memo}
              onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
              rows={3}
              placeholder="サイズ・色・提出方法など"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm bg-white outline-none focus:border-stone-400 resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-stone-200/70 shrink-0 flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl bg-stone-100 text-stone-600 font-bold active:scale-95">
            キャンセル
          </button>
          <button
            onClick={onSave}
            className="flex-1 py-3.5 rounded-2xl text-white font-black active:scale-95"
            style={{ background: ACCENT }}
          >
            {draft.id ? '保存' : '追加'}
          </button>
        </div>
      </div>
    </div>
  );
}
