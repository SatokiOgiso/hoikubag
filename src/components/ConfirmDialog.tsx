import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  /** 破壊的操作(削除など)は赤系で強調 */
  destructive?: boolean;
}

interface Props extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

/** 取り返しのつきにくい操作の前に挟む確認ダイアログ */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'OK',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  // Escape キーでキャンセルできるようにする
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs bg-white rounded-3xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="px-6 pt-6 pb-5 text-center">
          <div
            className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
              destructive ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
            }`}
          >
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-base font-black text-stone-800 mb-1.5">{title}</h3>
          <p className="text-sm text-stone-500 leading-relaxed whitespace-pre-line">{message}</p>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={onCancel}
            autoFocus={destructive}
            className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-600 font-bold active:scale-95 transition-all"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-2xl text-white font-bold active:scale-95 transition-all ${
              destructive ? 'bg-red-500' : 'bg-amber-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
