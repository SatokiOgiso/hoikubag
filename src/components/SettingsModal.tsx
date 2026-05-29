import { useState } from 'react';
import { X, Plus, Minus, Trash2, RefreshCw } from 'lucide-react';
import type { AppState } from '../types';
import { ITEMS, COMMON_LOCATIONS, ACCENT, DEFAULT_THRESHOLD } from '../constants';

interface Props {
  state: AppState;
  onClose: () => void;
  actions: {
    addChild: () => void;
    renameChild: (id: string, name: string) => void;
    removeChild: (id: string) => void;
    selectChild: (id: string) => void;
    changeDefault: (key: string, delta: number) => void;
    saveCurrentAsDefault: () => void;
    setLocation: (name: string) => void;
    setThreshold: (n: number) => void;
    resetAll: () => void;
  };
}

/** 設定モーダル(下から立ち上がる/デスクトップは中央) */
export default function SettingsModal({ state, onClose, actions }: Props) {
  const [citySearch, setCitySearch] = useState('');
  const currentChild = state.children.find((c) => c.id === state.currentChildId);

  const commitCity = () => {
    if (!citySearch.trim()) return;
    actions.setLocation(citySearch.trim());
    setCitySearch('');
  };

  return (
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
                    onClick={() => actions.removeChild(c.id)}
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
              onClick={actions.saveCurrentAsDefault}
              className="w-full bg-white rounded-xl py-2.5 mb-2 border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 active:scale-95 transition-all"
            >
              📥 {currentChild?.name}の現在の入力をデフォルトに保存
            </button>

            {/* 品目編集リスト */}
            <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
              {ITEMS.map((item) => {
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
              onClick={() => {
                actions.resetAll();
                onClose();
              }}
              className="w-full bg-white rounded-xl py-3 border border-stone-200 text-stone-700 font-bold hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all"
            >
              全員分の準備リストをリセット
            </button>
          </section>

          {/* 家族との同期(v1 は案内のみ) */}
          <section>
            <h3 className="text-sm font-bold text-stone-700 mb-2">📱 家族とのデータ同期</h3>
            <div className="bg-white rounded-xl p-4 border border-stone-200 text-xs text-stone-600 leading-relaxed space-y-2">
              <p>
                現在のバージョンでは、データは
                <span className="font-bold text-stone-800">この端末内にのみ保存</span>
                されます。家族間でのデータ共有は今後のアップデートで対応予定です。
              </p>
              <p className="text-stone-500 flex items-center gap-1.5">
                <RefreshCw size={12} />
                同じ端末・ブラウザであれば、次回開いたときも入力内容が保持されます。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
