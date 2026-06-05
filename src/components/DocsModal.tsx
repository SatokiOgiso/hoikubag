import { useState, useRef } from 'react';
import { X, Plus, Trash2, Pencil, ImagePlus, Check, Loader2 } from 'lucide-react';
import type { AppState, DocEntry, DocCategory, DocImage } from '../types';
import { ACCENT } from '../constants';
import {
  DOC_CATEGORY_LABEL,
  DOC_CATEGORY_EMOJI,
  docDateLabel,
  isDocDatePast,
  sortDocs,
} from '../lib/docs';
import { uploadDocImage, deleteDocImage, BlobNotConfiguredError } from '../lib/docphoto';

interface Props {
  state: AppState;
  myName: string;
  onSetMyName: (name: string) => void;
  showToast: (msg: string, undo?: () => void) => void;
  onClose: () => void;
  actions: {
    addDoc: (input: Omit<DocEntry, 'id' | 'createdAt' | 'updatedAt'>) => boolean;
    updateDoc: (doc: DocEntry) => void;
    removeDoc: (id: string) => void;
    toggleDocConfirmed: (id: string, name: string) => void;
  };
}

const CATEGORIES: DocCategory[] = ['request', 'event', 'other'];

interface Draft {
  id: string | null;
  title: string;
  category: DocCategory;
  date: string;
  memo: string;
  images: DocImage[];
}

const emptyDraft = (category: DocCategory = 'request'): Draft => ({
  id: null,
  title: '',
  category,
  date: '',
  memo: '',
  images: [],
});

/** 書類リスト(写真付き)のモーダル */
export default function DocsModal({ state, myName, onSetMyName, showToast, onClose, actions }: Props) {
  const docs = state.docs ?? [];
  const [filter, setFilter] = useState<'all' | DocCategory>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  // 名前未設定で確認しようとした書類
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');

  const visible = sortDocs(filter === 'all' ? docs : docs.filter((d) => d.category === filter));

  const openNew = () => setDraft(emptyDraft(filter === 'all' ? 'request' : filter));
  const openEdit = (d: DocEntry) =>
    setDraft({
      id: d.id,
      title: d.title,
      category: d.category,
      date: d.date ?? '',
      memo: d.memo ?? '',
      images: d.images,
    });

  const saveDraft = () => {
    if (!draft) return;
    const payload = {
      title: draft.title,
      category: draft.category,
      date: draft.date || undefined,
      memo: draft.memo.trim() || undefined,
      images: draft.images,
    };
    if (draft.id) {
      const existing = docs.find((d) => d.id === draft.id);
      if (existing) actions.updateDoc({ ...existing, ...payload });
      setDraft(null);
    } else {
      if (actions.addDoc(payload)) setDraft(null);
    }
  };

  const confirmDoc = (d: DocEntry) => {
    const me = myName.trim();
    if (!me) {
      setNameInput('');
      setPendingConfirm(d.id);
      return;
    }
    actions.toggleDocConfirmed(d.id, me);
  };

  const submitName = () => {
    const name = nameInput.trim();
    if (!name) return;
    onSetMyName(name);
    if (pendingConfirm) actions.toggleDocConfirmed(pendingConfirm, name);
    setPendingConfirm(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FAF5EA] rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-black text-stone-800">書類</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 active:scale-95"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* 分類フィルタ */}
        <div className="px-5 pb-2 shrink-0 flex gap-2 overflow-x-auto no-scrollbar">
          <FilterChip label="すべて" active={filter === 'all'} onClick={() => setFilter('all')} />
          {CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              label={`${DOC_CATEGORY_EMOJI[c]} ${DOC_CATEGORY_LABEL[c]}`}
              active={filter === c}
              onClick={() => setFilter(c)}
            />
          ))}
        </div>

        {/* 一覧 */}
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {visible.length === 0 ? (
            <div className="text-center text-stone-400 text-sm font-medium py-10">
              まだ書類がありません。
              <br />
              下の「追加」から写真を保存できます。
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((d) => (
                <DocCard
                  key={d.id}
                  doc={d}
                  myName={myName}
                  onView={setViewer}
                  onEdit={() => openEdit(d)}
                  onDelete={() => actions.removeDoc(d.id)}
                  onToggleConfirm={() => confirmDoc(d)}
                />
              ))}
            </div>
          )}
        </div>

        {/* フッター: 追加 */}
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
        <DocForm
          draft={draft}
          setDraft={setDraft}
          showToast={showToast}
          onSave={saveDraft}
          onCancel={() => setDraft(null)}
        />
      )}

      {/* 写真の全画面ビューア */}
      {viewer && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-2"
          onClick={() => setViewer(null)}
        >
          <img src={viewer} alt="書類" className="max-w-full max-h-full object-contain" />
          <button
            onClick={() => setViewer(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-95"
            aria-label="閉じる"
          >
            <X size={22} />
          </button>
        </div>
      )}

      {/* 名前の入力(初回の確認時) */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          onClick={() => setPendingConfirm(null)}
        >
          <div
            className="w-full max-w-xs bg-white rounded-3xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-stone-800 mb-1">あなたの名前は?</h3>
            <p className="text-sm text-stone-500 mb-3">確認した人として記録します(あとから変更できます)。</p>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitName()}
              placeholder="例: ママ / パパ"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold mb-3 outline-none focus:border-stone-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPendingConfirm(null)}
                className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-600 font-bold active:scale-95"
              >
                キャンセル
              </button>
              <button
                onClick={submitName}
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

function DocCard({
  doc,
  myName,
  onView,
  onEdit,
  onDelete,
  onToggleConfirm,
}: {
  doc: DocEntry;
  myName: string;
  onView: (url: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleConfirm: () => void;
}) {
  const dateLabel = docDateLabel(doc.date);
  const past = isDocDatePast(doc.date);
  const confirmedBy = doc.confirmedBy ?? [];
  const iConfirmed = !!myName.trim() && confirmedBy.includes(myName.trim());

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          {/* 分類 + タイトル */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-stone-400">
              {DOC_CATEGORY_EMOJI[doc.category]} {DOC_CATEGORY_LABEL[doc.category]}
            </span>
            <span className="text-[15px] font-bold text-stone-800">{doc.title}</span>
          </div>

          {/* 日付 */}
          {dateLabel && (
            <div className="mt-1">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  past ? 'bg-stone-100 text-stone-400' : 'bg-orange-50 text-orange-600'
                }`}
              >
                📅 {dateLabel}
              </span>
            </div>
          )}

          {/* メモ */}
          {doc.memo && (
            <p className="text-[13px] text-stone-500 mt-1.5 whitespace-pre-line leading-relaxed">{doc.memo}</p>
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

      {/* 写真サムネイル */}
      {doc.images.length > 0 && (
        <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
          {doc.images.map((img) => (
            <button
              key={img.url}
              onClick={() => onView(img.url)}
              className="shrink-0 rounded-xl overflow-hidden border border-stone-200 active:scale-95"
            >
              <img src={img.url} alt="書類の写真" className="h-24 w-auto object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* 確認 */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <button
          onClick={onToggleConfirm}
          className={`text-[12px] font-bold rounded-full px-3 py-1 active:scale-95 flex items-center gap-1 ${
            iConfirmed ? 'text-white' : 'bg-stone-100 text-stone-600'
          }`}
          style={iConfirmed ? { background: ACCENT } : undefined}
        >
          <Check size={13} /> {iConfirmed ? '確認済み' : '確認した'}
        </button>
        {confirmedBy.length > 0 && (
          <span className="text-[11px] font-bold text-stone-400">
            {confirmedBy.join('・')} が確認
          </span>
        )}
      </div>
    </div>
  );
}

function DocForm({
  draft,
  setDraft,
  showToast,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  showToast: (msg: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [uploading, setUploading] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading((n) => n + list.length);
    const uploaded: DocImage[] = [];
    let notConfigured = false;
    let failed = false;
    for (const file of list) {
      try {
        uploaded.push(await uploadDocImage(file));
      } catch (e) {
        if (e instanceof BlobNotConfiguredError) notConfigured = true;
        else failed = true;
      } finally {
        setUploading((n) => n - 1);
      }
    }
    // この pick で取得した分をまとめて追記(複数枚でも取りこぼさない)
    if (uploaded.length > 0) setDraft({ ...draft, images: [...draft.images, ...uploaded] });
    if (notConfigured) showToast('写真の保存にはセットアップが必要です(管理者にご連絡ください)');
    else if (failed) showToast('一部の写真のアップロードに失敗しました');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (img: DocImage) => {
    setDraft({ ...draft, images: draft.images.filter((i) => i.url !== img.url) });
    // Blob からも削除(ベストエフォート)
    deleteDocImage(img.url).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-md bg-[#FAF5EA] rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
          <h2 className="text-lg font-black text-stone-800">{draft.id ? '書類を編集' : '書類を追加'}</h2>
          <button onClick={onCancel} className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 active:scale-95" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
          {/* 写真 */}
          <div>
            <label className="text-[13px] font-bold text-stone-500 mb-1.5 block">写真</label>
            <div className="flex gap-2 flex-wrap">
              {draft.images.map((img) => (
                <div key={img.url} className="relative">
                  <img src={img.url} alt="書類" className="h-24 w-24 object-cover rounded-xl border border-stone-200" />
                  <button
                    onClick={() => removeImage(img)}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-stone-800 text-white flex items-center justify-center active:scale-90"
                    aria-label="写真を削除"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {/* 追加ボタン */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading > 0}
                className="h-24 w-24 rounded-xl border-2 border-dashed border-stone-300 text-stone-400 flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
              >
                {uploading > 0 ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <>
                    <ImagePlus size={22} />
                    <span className="text-[11px] font-bold">写真を追加</span>
                  </>
                )}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onPickFiles(e.target.files)}
            />
          </div>

          {/* 分類 */}
          <div>
            <label className="text-[13px] font-bold text-stone-500 mb-1.5 block">分類</label>
            <div className="flex gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft({ ...draft, category: c })}
                  className={`flex-1 py-2.5 rounded-2xl text-[13px] font-bold active:scale-95 border ${
                    draft.category === c ? 'text-white border-transparent' : 'bg-white text-stone-500 border-stone-200'
                  }`}
                  style={draft.category === c ? { background: ACCENT } : undefined}
                >
                  {DOC_CATEGORY_EMOJI[c]} {DOC_CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {/* タイトル */}
          <div>
            <label className="text-[13px] font-bold text-stone-500 mb-1.5 block">タイトル</label>
            <input
              autoFocus={!draft.id}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="例: 遠足のお知らせ"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold bg-white outline-none focus:border-stone-400"
            />
          </div>

          {/* 日付 */}
          <div>
            <label className="text-[13px] font-bold text-stone-500 mb-1.5 block">
              {draft.category === 'event' ? 'イベント日(任意)' : '提出期限(任意)'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="flex-1 rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold bg-white outline-none focus:border-stone-400"
              />
              {draft.date && (
                <button onClick={() => setDraft({ ...draft, date: '' })} className="text-[13px] font-bold text-stone-400 px-2 active:scale-95">
                  クリア
                </button>
              )}
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="text-[13px] font-bold text-stone-500 mb-1.5 block">メモ(任意)</label>
            <textarea
              value={draft.memo}
              onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
              rows={3}
              placeholder="持ち物・集合時間・提出方法など"
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
            disabled={uploading > 0}
            className="flex-1 py-3.5 rounded-2xl text-white font-black active:scale-95 disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {draft.id ? '保存' : '追加'}
          </button>
        </div>
      </div>
    </div>
  );
}
