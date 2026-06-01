import { X, BarChart3, Trophy, CalendarCheck, Users, ArrowRight } from 'lucide-react';
import { ACCENT } from '../constants';

interface Props {
  onOpen: () => void; // 分析画面を開く
  onClose: () => void; // あとで(閉じる)
}

/** 新機能「分析」のお知らせ画面(オンボーディングと同じ意匠の1画面スポットライト) */
export default function AnalyticsIntro({ onOpen, onClose }: Props) {
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
          {/* 新機能バッジ */}
          <span
            className="text-xs font-black text-white px-3 py-1 rounded-full mb-4"
            style={{ background: ACCENT }}
          >
            ✨ 新機能
          </span>

          <div className="w-20 h-20 rounded-3xl bg-white border border-stone-200 flex items-center justify-center mb-4">
            <BarChart3 size={40} style={{ color: ACCENT }} />
          </div>

          <h1 className="text-2xl font-black text-stone-800 tracking-tight mb-2">
            準備の記録が
            <br />
            見られるようになりました
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed font-medium mb-5">
            毎日の「確定」がそのまま記録に。
            <br />
            これまでの準備をふりかえって、達成感を味わえます。
          </p>

          {/* ミニプレビュー(実際の見た目のイメージ) */}
          <div className="w-full rounded-3xl p-4 text-white shadow-sm mb-3" style={{ background: ACCENT }}>
            <div className="text-xs font-bold opacity-90 mb-2 text-left">これまでの達成</div>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/15 rounded-2xl px-3 py-2 text-left">
                <div className="text-[10px] font-bold opacity-90">準備した日</div>
                <div>
                  <span className="text-2xl font-black">12</span>
                  <span className="text-sm font-bold ml-0.5">日</span>
                </div>
              </div>
              <div className="flex-1 bg-white/15 rounded-2xl px-3 py-2 text-left">
                <div className="text-[10px] font-bold opacity-90">用意したアイテム</div>
                <div>
                  <span className="text-2xl font-black">84</span>
                  <span className="text-sm font-bold ml-0.5">個</span>
                </div>
              </div>
            </div>
          </div>

          {/* できること一覧 */}
          <div className="w-full space-y-2 text-left">
            <FeatureRow icon={<CalendarCheck size={18} />} text="準備した日数とアイテム総数がひと目で" />
            <FeatureRow icon={<Trophy size={18} />} text="続けるほど「達成バッジ」がたまる" />
            <FeatureRow icon={<BarChart3 size={18} />} text="何をいくつ用意したかをランキング表示" />
            <FeatureRow icon={<Users size={18} />} text="子どもごと・期間ごとに切り替え" />
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
          さっそく見てみる <ArrowRight size={18} />
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
