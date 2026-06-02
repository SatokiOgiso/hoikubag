import { useMemo, useState } from 'react';
import { X, BarChart3, Trophy, Sparkles, ChevronRight, CalendarCheck, Package } from 'lucide-react';
import type { AppState, Item } from '../types';
import { ACCENT } from '../constants';
import {
  calcChildStats,
  getLastNDays,
  rankItems,
  computeBadges,
  badgeWindow,
  type ChildStats,
} from '../lib/statistics';

interface Props {
  state: AppState;
  items: Item[]; // 標準 + カスタム品目(絵文字の参照用)
  onClose: () => void;
}

type Range = 'all' | 'month';
type Target = 'everyone' | string; // 'everyone' か childId

// バッジは指数的でなく一定間隔で定期的に獲得できるようにする
const DAYS_STEP = 5; // 5日ごとにメダル(初回のみ1日)
const DAYS_FIRST = 1; // 初回だけ「はじめての準備」を1日で
const ITEMS_STEP = 10;

export default function AnalyticsModal({ state, items, onClose }: Props) {
  const closed = state.closedWeekdays ?? [];
  const multiChild = state.children.length > 1;
  const [range, setRange] = useState<Range>('all');
  const [target, setTarget] = useState<Target>(multiChild ? 'everyone' : state.children[0].id);

  const monthSet = useMemo(() => new Set(getLastNDays(30)), []);
  const dateSet = range === 'month' ? monthSet : undefined;

  const emojiOf = (key: string) => items.find((i) => i.key === key)?.emoji ?? '📦';

  // 期間に応じた統計(ヒーロー数字・ランキング用)
  const statsByChild = useMemo(
    () => state.children.map((c) => calcChildStats(c, closed, dateSet)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, range]
  );
  // 全期間の統計(バッジは集めたものが消えないよう常に全期間で判定)
  const allTimeByChild = useMemo(
    () => state.children.map((c) => calcChildStats(c, closed)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  );
  const statOf = (id: string) => statsByChild.find((s) => s.childId === id)!;
  const allTimeOf = (id: string) => allTimeByChild.find((s) => s.childId === id)!;

  const badgeCount = (s: ChildStats) =>
    computeBadges(s.days, DAYS_STEP, DAYS_FIRST).earnedCount +
    computeBadges(s.totalItems, ITEMS_STEP).earnedCount;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div
        className="bg-stone-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col"
        style={{ maxHeight: '92dvh' }}
      >
        {/* ヘッダー */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-stone-200 shrink-0 bg-stone-50 rounded-t-3xl">
          <h2 className="text-xl font-black text-stone-800 flex items-center gap-2">
            <BarChart3 size={22} style={{ color: ACCENT }} /> 分析
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center active:scale-95"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* スクロール領域 */}
        <div
          className="overflow-y-auto overscroll-contain p-5 space-y-5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* 対象セレクタ(2人以上のときだけ) */}
          {multiChild && (
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
              <SelectorPill active={target === 'everyone'} onClick={() => setTarget('everyone')}>
                みんな
              </SelectorPill>
              {state.children.map((c) => (
                <SelectorPill key={c.id} active={target === c.id} onClick={() => setTarget(c.id)}>
                  {c.name}
                </SelectorPill>
              ))}
            </div>
          )}

          {/* 期間トグル */}
          <div className="flex gap-1.5">
            <SelectorPill active={range === 'all'} onClick={() => setRange('all')} grow>
              ぜんぶ
            </SelectorPill>
            <SelectorPill active={range === 'month'} onClick={() => setRange('month')} grow>
              直近1ヶ月
            </SelectorPill>
          </div>

          {target === 'everyone' && multiChild ? (
            <EveryoneView
              statsByChild={statsByChild}
              allTimeByChild={allTimeByChild}
              badgeCount={badgeCount}
              onSelectChild={setTarget}
            />
          ) : (
            <IndividualView
              stat={statOf(target === 'everyone' ? state.children[0].id : target)}
              allTime={allTimeOf(target === 'everyone' ? state.children[0].id : target)}
              rangeLabel={range === 'all' ? 'これまで' : '直近1ヶ月で'}
              emojiOf={emojiOf}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- 共通の小さなピルボタン ---- */
function SelectorPill({
  active,
  grow,
  onClick,
  children,
}: {
  active: boolean;
  grow?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 ${grow ? 'flex-1' : ''} px-3.5 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
        active ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 border border-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

/* ---- みんな(全員)ビュー: 全員分の達成・バッジを1画面で ---- */
function EveryoneView({
  statsByChild,
  allTimeByChild,
  badgeCount,
  onSelectChild,
}: {
  statsByChild: ChildStats[];
  allTimeByChild: ChildStats[];
  badgeCount: (s: ChildStats) => number;
  onSelectChild: (id: string) => void;
}) {
  const totalDays = statsByChild.reduce((a, s) => a + s.days, 0);
  const totalItems = statsByChild.reduce((a, s) => a + s.totalItems, 0);
  const allTimeOf = (id: string) => allTimeByChild.find((a) => a.childId === id)!;
  return (
    <div className="space-y-4">
      {/* 家族の合計バナー */}
      <div className="rounded-3xl p-5 text-white shadow-sm" style={{ background: ACCENT }}>
        <div className="text-sm font-bold opacity-90 mb-1">家族みんなの合計</div>
        <div className="flex items-end gap-5">
          <div>
            <span className="text-4xl font-black leading-none">{totalDays}</span>
            <span className="text-base font-bold ml-1">日 準備</span>
          </div>
          <div>
            <span className="text-4xl font-black leading-none">{totalItems}</span>
            <span className="text-base font-bold ml-1">個 用意</span>
          </div>
        </div>
      </div>

      {/* 子どもごとの達成カード(バッジも全員分表示) */}
      {statsByChild.map((s) => {
        const at = allTimeOf(s.childId);
        return (
          <div
            key={s.childId}
            className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-lg text-stone-800">{s.childName}</span>
              <button
                onClick={() => onSelectChild(s.childId)}
                className="flex items-center gap-1 text-stone-500 text-sm font-bold active:scale-95 transition-all"
                aria-label={`${s.childName}の詳細を見る`}
              >
                <Trophy size={15} style={{ color: ACCENT }} /> バッジ {badgeCount(at)}
                <ChevronRight size={16} className="text-stone-300" />
              </button>
            </div>
            <div className="flex gap-2">
              <MiniStat icon={<CalendarCheck size={16} />} value={s.days} unit="日 準備" />
              <MiniStat icon={<Package size={16} />} value={s.totalItems} unit="個 用意" />
            </div>
            {/* 達成バッジ(全期間ベース) */}
            <BadgeStrip label="準備した日数" value={at.days} unit="日" step={DAYS_STEP} first={DAYS_FIRST} />
            <BadgeStrip label="用意したアイテム" value={at.totalItems} unit="個" step={ITEMS_STEP} />
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ icon, value, unit }: { icon: React.ReactNode; value: number; unit: string }) {
  return (
    <div className="flex-1 bg-stone-50 rounded-xl px-3 py-2.5 border border-stone-100">
      <div className="flex items-center gap-1 text-stone-400 mb-0.5">{icon}</div>
      <div>
        <span className="text-2xl font-black text-stone-800">{value}</span>
        <span className="text-xs font-bold text-stone-500 ml-1">{unit}</span>
      </div>
    </div>
  );
}

/* ---- 個別ビュー: 1人分の詳細 ---- */
function IndividualView({
  stat,
  allTime,
  rangeLabel,
  emojiOf,
}: {
  stat: ChildStats;
  allTime: ChildStats;
  rangeLabel: string;
  emojiOf: (key: string) => string;
}) {
  if (stat.days === 0) {
    return (
      <div className="text-center py-12 px-6">
        <div className="text-5xl mb-3">📊</div>
        <div className="font-black text-stone-700 mb-1">まだ記録がありません</div>
        <div className="text-sm text-stone-500 leading-relaxed">
          準備リストを「確定」すると、ここに{stat.childName}の実績がたまっていきます。
        </div>
      </div>
    );
  }
  const ranked = rankItems(stat.byItem);
  const maxQty = ranked.length > 0 ? ranked[0][1] : 1;

  return (
    <div className="space-y-5">
      {/* ヒーロー達成カード */}
      <div className="rounded-3xl p-5 text-white shadow-sm" style={{ background: ACCENT }}>
        <div className="text-sm font-bold opacity-90 mb-3 flex items-center gap-1.5">
          <Sparkles size={16} /> {stat.childName}の達成
        </div>
        <div className="flex items-stretch gap-3">
          <div className="flex-1 bg-white/15 rounded-2xl px-4 py-3">
            <div className="text-xs font-bold opacity-90 mb-0.5">{rangeLabel}準備した日</div>
            <div>
              <span className="text-4xl font-black leading-none">{stat.days}</span>
              <span className="text-lg font-bold ml-1">日</span>
            </div>
          </div>
          <div className="flex-1 bg-white/15 rounded-2xl px-4 py-3">
            <div className="text-xs font-bold opacity-90 mb-0.5">用意したアイテム</div>
            <div>
              <span className="text-4xl font-black leading-none">{stat.totalItems}</span>
              <span className="text-lg font-bold ml-1">個</span>
            </div>
          </div>
        </div>
      </div>

      {/* 達成バッジ(全期間ベース) */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-stone-700 flex items-center gap-1.5">
          <Trophy size={16} style={{ color: ACCENT }} /> 達成バッジ
        </h3>
        <BadgeStrip label="準備した日数" value={allTime.days} unit="日" step={DAYS_STEP} first={DAYS_FIRST} />
        <BadgeStrip label="用意したアイテム" value={allTime.totalItems} unit="個" step={ITEMS_STEP} />
      </div>

      {/* 品目ランキング */}
      <div className="space-y-2">
        <h3 className="text-sm font-black text-stone-700 flex items-center gap-1.5">
          <BarChart3 size={16} style={{ color: ACCENT }} /> 何をいくつ用意したか
        </h3>
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
          {ranked.map(([key, qty]) => (
            <div key={key} className="px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl w-7 text-center shrink-0">{emojiOf(key)}</span>
                <span className="flex-1 text-sm font-bold text-stone-700 truncate">{key}</span>
                <span className="text-sm font-black text-stone-800 shrink-0">{qty}</span>
              </div>
              <div className="h-2 rounded-full bg-stone-100 overflow-hidden ml-9">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(6, (qty / maxQty) * 100)}%`, background: ACCENT }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- バッジ帯(獲得数 + メダル列 + 次の目標までの進捗) ---- */
function BadgeStrip({
  label,
  value,
  unit,
  step,
  first,
}: {
  label: string;
  value: number;
  unit: string;
  step: number;
  first?: number;
}) {
  const b = computeBadges(value, step, first);
  const medals = badgeWindow(value, step, first);
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-bold text-stone-600">{label}</span>
        <span className="text-xs font-black text-stone-500">🏅 {b.earnedCount}個 獲得</span>
      </div>

      {/* メダル列(現在地点の前後だけ) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-2.5">
        {medals.map((m) => (
          <div
            key={m.value}
            className={`shrink-0 w-12 h-12 rounded-full flex flex-col items-center justify-center text-xs font-black border-2 ${
              m.earned
                ? 'text-white border-transparent'
                : m.isNext
                ? 'bg-white text-stone-700'
                : 'bg-stone-50 text-stone-300 border-stone-200'
            }`}
            style={
              m.earned
                ? { background: ACCENT, borderColor: ACCENT }
                : m.isNext
                ? { borderColor: ACCENT }
                : undefined
            }
          >
            <span className="leading-none">{m.value}</span>
            <span className="text-[9px] font-bold opacity-80 leading-none mt-0.5">{unit}</span>
          </div>
        ))}
      </div>

      {/* 次の目標までの進捗 */}
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden mb-1">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.round(b.progress * 100)}%`, background: ACCENT }}
        />
      </div>
      <div className="text-[11px] font-bold text-stone-400">
        あと {b.toNext}
        {unit}で {b.nextTarget}
        {unit}達成
      </div>
    </div>
  );
}
