import { useState } from 'react';
import { Settings } from 'lucide-react';
import { DEFAULT_THRESHOLD, ITEMS } from './constants';
import { useAppState } from './hooks/useAppState';
import BagSummary from './components/BagSummary';
import WeatherCard from './components/WeatherCard';
import ChildTabs from './components/ChildTabs';
import ItemList from './components/ItemList';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const { state, loading, toast, familyId, actions } = useAppState();
  const [showSettings, setShowSettings] = useState(false);

  if (loading || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-stone-500">読み込み中...</div>
      </div>
    );
  }

  const currentChild =
    state.children.find((c) => c.id === state.currentChildId) || state.children[0];

  const tempHigh = state.weather?.high;
  const threshold = state.thresholdTemp ?? DEFAULT_THRESHOLD;
  const hasTemp = tempHigh != null;
  const isHot = hasTemp && tempHigh > threshold;
  const isCool = hasTemp && tempHigh <= threshold;

  // 標準品目 + ユーザー追加品目
  const allItems = [...ITEMS, ...state.customItems];

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
        {/* ヘッダー */}
        <header className="px-5 pt-7 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] tracking-[0.35em] text-stone-500 font-medium mb-1">
                DAYCARE · PREP
              </div>
              <h1 className="text-3xl font-black text-stone-800 leading-tight">保育園準備</h1>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="w-11 h-11 rounded-2xl bg-white border border-stone-200 flex items-center justify-center active:scale-95 transition-all"
              aria-label="設定"
            >
              <Settings size={18} className="text-stone-600" />
            </button>
          </div>
        </header>

        <BagSummary state={state} items={allItems} onSelectChild={actions.selectChild} />

        <WeatherCard
          state={state}
          onSetManualWeather={actions.setManualWeather}
          onClearWeather={actions.clearWeather}
        />

        <ChildTabs
          children={state.children}
          currentChildId={state.currentChildId}
          onSelectChild={actions.selectChild}
        />

        <ItemList
          child={currentChild}
          items={allItems}
          isHot={isHot}
          isCool={isCool}
          onChangeItem={actions.changeItem}
          onReset={actions.resetChild}
        />
      </div>

      {showSettings && (
        <SettingsModal
          state={state}
          items={allItems}
          familyId={familyId}
          onClose={() => setShowSettings(false)}
          actions={actions}
        />
      )}

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-800 text-white px-5 py-3 rounded-2xl shadow-lg z-50 font-bold text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
