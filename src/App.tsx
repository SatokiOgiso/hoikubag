import { useState, useEffect } from 'react';
import { Settings, BarChart3, ClipboardList } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { DEFAULT_THRESHOLD, DEFAULT_CLOSED_WEEKDAYS, DEFAULT_ROLLOVER, ITEMS, STORAGE_KEY } from './constants';
import { useAppState } from './hooks/useAppState';
import DateStrip from './components/DateStrip';
import BagSummary from './components/BagSummary';
import ItemList from './components/ItemList';
import SettingsModal from './components/SettingsModal';
import AnalyticsModal from './components/AnalyticsModal';
import AnalyticsIntro from './components/AnalyticsIntro';
import PrepListModal from './components/PrepListModal';
import PrepListIntro from './components/PrepListIntro';
import Onboarding, { type OnboardingData } from './components/Onboarding';
import { incompleteTaskCount, hasUrgentTask } from './lib/tasks';
import { syncSubscriptionFamily } from './lib/push';

const ONBOARDED_KEY = 'hoiku-onboarded-v1';
// 新機能「分析」のお知らせを一度だけ出すためのフラグ
const FEATURE_ANALYTICS_KEY = 'hoiku-feature-analytics-v1';
// 新機能「準備リスト」のお知らせを一度だけ出すためのフラグ
const FEATURE_PREPLIST_KEY = 'hoiku-feature-preplist-v1';
// 端末ごとの自分の名前(担当の手挙げ用。同期しない)
const MY_NAME_KEY = 'hoiku-my-name';

export default function App() {
  const {
    state,
    loading,
    toast,
    familyId,
    syncStatus,
    syncError,
    forecast,
    weatherLoading,
    selectedDate,
    setSelectedDate,
    showToast,
    actions,
  } = useAppState();
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAnalyticsIntro, setShowAnalyticsIntro] = useState(false);
  const [showPrepList, setShowPrepList] = useState(false);
  const [showPrepListIntro, setShowPrepListIntro] = useState(false);
  const [myName, setMyNameState] = useState<string>(() => localStorage.getItem(MY_NAME_KEY) ?? '');
  const setMyName = (v: string) => {
    setMyNameState(v);
    localStorage.setItem(MY_NAME_KEY, v);
  };
  // オンボーディング: 初回起動 or 設定からの再表示
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingFirstRun, setOnboardingFirstRun] = useState(false);
  const [fontScale, setFontScaleState] = useState<number>(() => {
    const s = localStorage.getItem('fontScale');
    return s ? parseFloat(s) : 1.0;
  });
  const setFontScale = (v: number) => {
    const next = Math.round(Math.min(1.5, Math.max(0.7, v)) * 10) / 10;
    setFontScaleState(next);
    localStorage.setItem('fontScale', String(next));
  };
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale * 16}px`;
    return () => { document.documentElement.style.fontSize = ''; };
  }, [fontScale]);

  // 通知購読済みの端末は、現在の familyId を購読情報に同期しておく。
  // (家族向けの確定お願い通知が確実に届くようにするため)
  useEffect(() => {
    if (loading) return;
    syncSubscriptionFamily(familyId).catch(() => {});
  }, [loading, familyId]);

  // 初回起動判定: まだオンボーディング未完了 かつ 既存データ/共有がない時だけ表示
  useEffect(() => {
    if (loading) return;
    if (localStorage.getItem(ONBOARDED_KEY)) return;
    // 既存ユーザー(保存データあり/共有参加済み)は対象外として静かに完了扱い
    if (familyId || localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(ONBOARDED_KEY, '1');
      return;
    }
    setOnboardingFirstRun(true);
    setShowOnboarding(true);
  }, [loading, familyId]);

  // 新機能「分析」のお知らせ: 既にオンボーディング済みの既存ユーザーに一度だけ表示
  useEffect(() => {
    if (loading) return;
    if (localStorage.getItem(FEATURE_ANALYTICS_KEY)) return;
    // 新規ユーザーは初期設定フローを通るので二重に出さない(データのある既存ユーザーのみ)
    const established = !!(familyId || localStorage.getItem(STORAGE_KEY));
    if (!established || !localStorage.getItem(ONBOARDED_KEY)) return;
    setShowAnalyticsIntro(true);
  }, [loading, familyId]);

  // 新機能「準備リスト」のお知らせ: 既存ユーザーに一度だけ表示
  // (分析のお知らせを済ませた後の起動で出す。重ねて表示しない)
  useEffect(() => {
    if (loading) return;
    if (localStorage.getItem(FEATURE_PREPLIST_KEY)) return;
    // 分析のお知らせがまだのユーザーには、そちらを先に出してから次回に回す
    if (!localStorage.getItem(FEATURE_ANALYTICS_KEY)) return;
    const established = !!(familyId || localStorage.getItem(STORAGE_KEY));
    if (!established || !localStorage.getItem(ONBOARDED_KEY)) return;
    setShowPrepListIntro(true);
  }, [loading, familyId]);

  const finishOnboarding = (data: OnboardingData) => {
    actions.applyOnboarding(data);
    localStorage.setItem(ONBOARDED_KEY, '1');
    // 初期設定を終えた新規ユーザーには新機能お知らせを出さない
    localStorage.setItem(FEATURE_ANALYTICS_KEY, '1');
    localStorage.setItem(FEATURE_PREPLIST_KEY, '1');
    setShowOnboarding(false);
  };
  const closeOnboarding = () => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    localStorage.setItem(FEATURE_ANALYTICS_KEY, '1');
    localStorage.setItem(FEATURE_PREPLIST_KEY, '1');
    setShowOnboarding(false);
  };
  const dismissPrepListIntro = () => {
    localStorage.setItem(FEATURE_PREPLIST_KEY, '1');
    setShowPrepListIntro(false);
  };
  const openPrepListFromIntro = () => {
    dismissPrepListIntro();
    setShowPrepList(true);
  };
  const dismissAnalyticsIntro = () => {
    localStorage.setItem(FEATURE_ANALYTICS_KEY, '1');
    setShowAnalyticsIntro(false);
  };
  const openAnalyticsFromIntro = () => {
    dismissAnalyticsIntro();
    setShowAnalytics(true);
  };
  const reopenOnboarding = () => {
    setOnboardingFirstRun(false);
    setShowSettings(false);
    setShowOnboarding(true);
  };

  if (loading || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-stone-500">読み込み中...</div>
      </div>
    );
  }

  const currentChild =
    state.children.find((c) => c.id === state.currentChildId) || state.children[0];

  // 選択中の日付の最高気温で袖の警告を判定
  const selectedForecast = forecast?.days.find((d) => d.date === selectedDate) ?? null;
  const tempHigh = selectedForecast?.high ?? null;
  const threshold = state.thresholdTemp ?? DEFAULT_THRESHOLD;
  const hasTemp = tempHigh != null;
  const isHot = hasTemp && tempHigh > threshold;
  const isCool = hasTemp && tempHigh <= threshold;

  // 標準品目 + ユーザー追加品目
  const allItems = [...ITEMS, ...state.customItems];

  // 準備リストの残数(未完了)とバッジの緊急度
  const tasks = state.tasks ?? [];
  const remainingTasks = incompleteTaskCount(tasks);
  const urgentTasks = hasUrgentTask(tasks);

  return (
    <div className="min-h-screen pb-16">
      {/* 背景の薄いドットパターン */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: 'radial-gradient(circle, #3D2818 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative max-w-lg mx-auto">
        {/* デプロイ識別用バージョン(最上部に小さく) */}
        <div className="text-center text-[10px] text-stone-400/70 font-medium pt-1 tracking-wide select-none">
          v{__APP_VERSION__}
        </div>
        {/* ヘッダー */}
        <header className="px-5 pt-1 pb-3">
          <div className="flex items-center justify-between">
            {/* ロゴ */}
            <div className="flex items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
                <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* ハンドル */}
                  <path d="M38 22 Q38 12 50 12 Q62 12 62 22" stroke="#D4A017" strokeWidth="7" strokeLinecap="round" fill="none"/>
                  {/* 本体 */}
                  <rect x="14" y="24" width="72" height="54" rx="16" fill="#F5C518"/>
                  {/* ポケット仕切り線 */}
                  <path d="M14 56 Q50 62 86 56" stroke="#D4A017" strokeWidth="3.5" fill="none"/>
                  {/* 服(青) */}
                  <ellipse cx="40" cy="44" rx="12" ry="10" fill="#A8C4DC" opacity="0.9"/>
                  {/* 服(緑) */}
                  <ellipse cx="54" cy="46" rx="14" ry="11" fill="#A8D4A8" opacity="0.9"/>
                  {/* サイドポケット左 */}
                  <rect x="6" y="50" width="12" height="20" rx="6" fill="#E8B010"/>
                  {/* サイドポケット右 */}
                  <rect x="82" y="50" width="12" height="20" rx="6" fill="#E8B010"/>
                </svg>
              </div>
              <span className="text-2xl font-black text-stone-800 tracking-tight">hoikubag</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 準備リスト(買い物・提出物・やること)。残数バッジ付き */}
              <button
                onClick={() => setShowPrepList(true)}
                className="relative w-14 h-14 rounded-2xl bg-white border border-stone-200 flex items-center justify-center active:scale-95 transition-all"
                aria-label="準備リスト"
              >
                <ClipboardList size={22} className="text-stone-600" />
                {remainingTasks > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-white text-[11px] font-black flex items-center justify-center ${
                      urgentTasks ? 'bg-red-500 ring-2 ring-white' : ''
                    }`}
                    style={urgentTasks ? undefined : { background: '#A8A29E' }}
                  >
                    {remainingTasks}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowAnalytics(true)}
                className="w-14 h-14 rounded-2xl bg-white border border-stone-200 flex items-center justify-center active:scale-95 transition-all"
                aria-label="分析"
              >
                <BarChart3 size={22} className="text-stone-600" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="w-14 h-14 rounded-2xl bg-white border border-stone-200 flex items-center justify-center active:scale-95 transition-all"
                aria-label="設定"
              >
                <Settings size={22} className="text-stone-600" />
              </button>
            </div>
          </div>
        </header>

        {/* 日付ストリップ(最上部・横スクロール) */}
        <DateStrip
          selectedDate={selectedDate}
          forecast={forecast}
          threshold={threshold}
          closedWeekdays={state.closedWeekdays ?? DEFAULT_CLOSED_WEEKDAYS}
          rolloverMinutes={state.rolloverMinutes ?? DEFAULT_ROLLOVER}
          onSelectDate={setSelectedDate}
          locationName={state.location?.name}
          weatherLoading={weatherLoading}
          onRefreshWeather={() => actions.fetchWeather()}
        />

        <BagSummary
          state={state}
          items={allItems}
          date={selectedDate}
          familyId={familyId}
          onSelectChild={actions.selectChild}
          showToast={showToast}
        />

        <ItemList
          child={currentChild}
          date={selectedDate}
          items={allItems}
          isHot={isHot}
          isCool={isCool}
          closedWeekdays={state.closedWeekdays ?? DEFAULT_CLOSED_WEEKDAYS}
          childCount={state.children.length}
          onChangeItem={actions.changeItem}
          onReset={actions.resetChild}
          onResetAll={actions.resetAll}
          onToggleConfirm={actions.toggleConfirm}
          onCopyBag={actions.copyBag}
          onChangeNotes={actions.changeNotes}
          onChangeItemNote={actions.changeItemNote}
          onChangeDayMemo={actions.changeDayMemo}
          showToast={showToast}
        />
      </div>

      {showSettings && (
        <SettingsModal
          state={state}
          items={allItems}
          familyId={familyId}
          syncStatus={syncStatus}
          syncError={syncError}
          selectedDate={selectedDate}
          fontScale={fontScale}
          onFontScale={setFontScale}
          showToast={showToast}
          onShowOnboarding={reopenOnboarding}
          onClose={() => setShowSettings(false)}
          actions={actions}
        />
      )}

      {showAnalytics && (
        <AnalyticsModal
          state={state}
          items={allItems}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {showAnalyticsIntro && (
        <AnalyticsIntro onOpen={openAnalyticsFromIntro} onClose={dismissAnalyticsIntro} />
      )}

      {showPrepList && (
        <PrepListModal
          state={state}
          myName={myName}
          onSetMyName={setMyName}
          showToast={showToast}
          onClose={() => setShowPrepList(false)}
          actions={actions}
        />
      )}

      {showPrepListIntro && (
        <PrepListIntro onOpen={openPrepListFromIntro} onClose={dismissPrepListIntro} />
      )}

      {showOnboarding && (
        <Onboarding
          state={state}
          isFirstRun={onboardingFirstRun}
          onComplete={finishOnboarding}
          onClose={closeOnboarding}
        />
      )}

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-800 text-white pl-5 pr-2 py-2 rounded-2xl shadow-lg z-50 font-bold text-sm flex items-center gap-3 max-w-[calc(100vw-2rem)]">
          <span className="py-1">{toast.message}</span>
          {toast.undo && (
            <button
              onClick={toast.undo}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-white/15 text-white font-bold active:scale-95 transition-all"
            >
              元に戻す
            </button>
          )}
        </div>
      )}
      <Analytics />
    </div>
  );
}
