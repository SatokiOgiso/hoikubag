import { X, ClipboardList, ShoppingCart, FileText, Hand, ArrowRight } from 'lucide-react';
import { ACCENT } from '../constants';

interface Props {
  onOpen: () => void; // 準備リストを開く
  onClose: () => void; // あとで(閉じる)
}

/** 新機能「準備リスト」のお知らせ画面(既存ユーザー向けオンボーディング) */
export default function PrepListIntro({ onOpen, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[60] bg-[#FAF5EA] flex flex-col">
      {/* 閉じる */}
      <div className="flex items-center justify-end px-5 pt-5 pb-2">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 active:scale-95"
          aria-label="閉じる"
        >
          <X size={20} />
        </button>
      </div>

      {/* 本文 */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        <div className="max-w-md mx-auto flex flex-col items-center text-center">
          <span
            className="text-xs font-black text-white px-3 py-1 rounded-full mb-4"
            style={{ background: ACCENT }}
          >
            ✨ 新機能
          </span>

          <div className="w-20 h-20 rounded-3xl bg-white border border-stone-200 flex items-center justify-center mb-4">
            <ClipboardList size={40} style={{ color: ACCENT }} />
          </div>

          <h1 className="text-2xl font-black text-stone-800 tracking-tight mb-2">
            買い物・提出物を
            <br />
            まとめて管理できます
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed font-medium mb-5">
            毎日のかばんとは別に、買わないといけないものや
            <br />
            提出書類を「準備リスト」で管理。
            <br />
            残りいくつかがヘッダーのバッジでひと目でわかります。
          </p>

          {/* できること一覧 */}
          <div className="w-full space-y-2 text-left">
            <FeatureRow icon={<ShoppingCart size={18} />} text="買うもの・準備するものを登録して残数を把握" />
            <FeatureRow icon={<FileText size={18} />} text="提出物に提出期限、持ち物に準備期限を設定" />
            <FeatureRow icon={<Hand size={18} />} text="「私がやる」で担当を手挙げ・家族と共有" />
            <FeatureRow icon={<ClipboardList size={18} />} text="買ったものはそのままかばんの持ち物に登録" />
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="px-6 py-4 space-y-2 border-t border-stone-200/70">
        <button
          onClick={onOpen}
          className="w-full py-3.5 rounded-2xl text-white font-black active:scale-95 flex items-center justify-center gap-2"
          style={{ background: ACCENT }}
        >
          さっそく使ってみる <ArrowRight size={18} />
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl text-stone-500 font-bold text-sm active:scale-95"
        >
          あとで
        </button>
      </div>
    </div>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl border border-stone-200 px-4 py-3">
      <span className="shrink-0" style={{ color: ACCENT }}>
        {icon}
      </span>
      <span className="text-sm font-bold text-stone-700">{text}</span>
    </div>
  );
}
