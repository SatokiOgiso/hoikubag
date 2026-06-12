import { useState } from 'react';
import { X, Plus, Minus, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { AppState } from '../types';
import { ITEMS, COMMON_LOCATIONS, ACCENT } from '../constants';

export interface OnboardingData {
  childNames: string[];
  location: string;
  defaults: Record<string, number>;
}

interface Props {
  state: AppState;
  /** 初回起動か(スキップボタンの出し分け用) */
  isFirstRun: boolean;
  onComplete: (data: OnboardingData) => void;
  onClose: () => void;
}

function OnboardFeature({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 bg-white rounded-2xl border border-stone-200 px-4 py-3">
      <span className="text-2xl leading-none mt-0.5 shrink-0">{emoji}</span>
      <div>
        <div className="text-sm font-bold text-stone-800 mb-0.5">{title}</div>
        <div className="text-xs text-stone-500 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

/** バッグのロゴ(ヘッダーと同じ意匠) */
function BagLogo() {
  return (
    <svg width="72" height="72" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M38 22 Q38 12 50 12 Q62 12 62 22" stroke="#D4A017" strokeWidth="7" strokeLinecap="round" fill="none" />
      <rect x="14" y="24" width="72" height="54" rx="16" fill="#F5C518" />
      <path d="M14 56 Q50 62 86 56" stroke="#D4A017" strokeWidth="3.5" fill="none" />
      <ellipse cx="40" cy="44" rx="12" ry="10" fill="#A8C4DC" opacity="0.9" />
      <ellipse cx="54" cy="46" rx="14" ry="11" fill="#A8D4A8" opacity="0.9" />
      <rect x="6" y="50" width="12" height="20" rx="6" fill="#E8B010" />
      <rect x="82" y="50" width="12" height="20" rx="6" fill="#E8B010" />
    </svg>
  );
}

const STEPS = ['ようこそ', '子どもの名前', '地域', 'よく入れる持ち物'] as const;

/** 初回オンボーディング(設定からも再表示可) */
export default function Onboarding({ state, isFirstRun, onComplete, onClose }: Props) {
  const [step, setStep] = useState(0);
  // 現在の状態をプリフィル(再表示時に上書きで消えないように)
  const [names, setNames] = useState<string[]>(() =>
    state.children.map((c) => c.name)
  );
  const [location, setLocation] = useState(state.location?.name ?? '');
  const [defaults, setDefaults] = useState<Record<string, number>>(() => ({
    ...(state.children[0]?.defaults ?? {}),
  }));

  const setName = (i: number, v: string) =>
    setNames((arr) => arr.map((n, idx) => (idx === i ? v : n)));
  const addName = () => setNames((arr) => [...arr, `子ども${arr.length + 1}`]);
  const removeName = (i: number) =>
    setNames((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)));

  const bumpDefault = (key: string, delta: number) =>
    setDefaults((d) => {
      const v = Math.max(0, (d[key] || 0) + delta);
      const next = { ...d };
      if (v === 0) delete next[key];
      else next[key] = v;
      return next;
    });

  const finish = () =>
    onComplete({ childNames: names, location, defaults });

  const isLast = step === STEPS.length - 1;
  const canNext = step === 1 ? names.some((n) => n.trim()) : true;

  return (
    <div className="fixed inset-0 z-[60] bg-[#FAF5EA] flex flex-col">
      {/* 進捗ドット + スキップ/閉じる */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6' : 'w-1.5'
              }`}
              style={{ background: i <= step ? ACCENT : '#E7E0D2' }}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          className="text-xs font-bold text-stone-400 active:scale-95 flex items-center gap-1"
        >
          {isFirstRun ? 'スキップ' : <X size={20} />}
        </button>
      </div>

      {/* 本文 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {step === 0 && (
          <div className="max-w-md mx-auto flex flex-col items-center text-center gap-5 py-2">
            <div className="w-24 h-24 rounded-3xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
              <BagLogo />
            </div>
            <div>
              <h1 className="text-3xl font-black text-stone-800 tracking-tight mb-2">hoikubag</h1>
              <p className="text-sm text-stone-600 leading-relaxed font-medium">
                保育園の毎日をかんたんに管理する
                <br />
                家族向けアプリです。
              </p>
            </div>

            {/* 機能紹介 */}
            <div className="w-full space-y-2 text-left">
              <OnboardFeature
                emoji="🎒"
                title="かばんの持ち物管理"
                desc="天気に合わせた服装ガイド付き。毎日の持ち物をかんたん準備。きょうだいも一緒に管理できます。"
              />
              <OnboardFeature
                emoji="📋"
                title="やること・準備リスト"
                desc="買い物・提出物・準備物を期限付きで登録。残り件数が常にヘッダーに表示されます。"
              />
              <OnboardFeature
                emoji="📊"
                title="準備の記録・統計"
                desc="毎日の「用意できた!」が記録として積み重なります。達成バッジや持ち物ランキングも確認できます。"
              />
              <OnboardFeature
                emoji="👨‍👩‍👧"
                title="家族で共有"
                desc="招待リンクを共有するだけでパートナーと同期。「私がやる」で担当も表明できます。"
              />
            </div>

            <p className="text-xs text-stone-400">
              はじめに、かんたんな初期設定をしましょう(あとから変更できます)。
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-black text-stone-800 mb-1">お子さまの名前</h2>
            <p className="text-sm text-stone-500 mb-5 leading-relaxed">
              持ち物を管理するお子さまの名前を入れてください。きょうだいも追加できます。
            </p>
            <div className="space-y-2">
              {names.map((name, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(i, e.target.value)}
                    placeholder={`子ども${i + 1}`}
                    className="flex-1 bg-white rounded-xl px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-400 text-stone-800"
                  />
                  {names.length > 1 && (
                    <button
                      onClick={() => removeName(i)}
                      className="px-3 rounded-xl bg-white border border-stone-200 text-stone-400 active:scale-95"
                      aria-label="削除"
                    >
                      <Minus size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addName}
              className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-stone-300 text-stone-500 font-bold text-sm active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Plus size={16} /> きょうだいを追加
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-black text-stone-800 mb-1">お住まいの地域</h2>
            <p className="text-sm text-stone-500 mb-5 leading-relaxed">
              天気予報と、服装(長袖・半袖)の目安に使います。
            </p>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例: 東京都、横浜市など"
              className="w-full bg-white rounded-xl px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-400 text-stone-800 mb-4"
            />
            <div className="text-[10px] text-stone-500 mb-1.5 font-bold tracking-wider">
              よく使う地域
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_LOCATIONS.map((name) => (
                <button
                  key={name}
                  onClick={() => setLocation(name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all ${
                    location === name
                      ? 'bg-stone-800 text-white'
                      : 'bg-white text-stone-600 border border-stone-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-black text-stone-800 mb-1">よく入れる持ち物</h2>
            <p className="text-sm text-stone-500 mb-5 leading-relaxed">
              毎日かばんに入れるものを選んでおくと、「デフォルト」としてすぐ呼び出せます。
              あとからでも設定できます。
            </p>
            <div className="space-y-1.5">
              {ITEMS.map((item) => {
                const qty = defaults[item.key] || 0;
                const on = qty > 0;
                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 border transition-all ${
                      on ? 'bg-white border-stone-300' : 'bg-white/50 border-stone-200'
                    }`}
                  >
                    <span className="text-xl w-7 text-center">{item.emoji}</span>
                    <span className={`flex-1 text-sm font-bold ${on ? 'text-stone-800' : 'text-stone-500'}`}>
                      {item.key}
                    </span>
                    {on ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => bumpDefault(item.key, -1)}
                          className="w-8 h-8 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center active:scale-95"
                          aria-label="減らす"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-5 text-center font-black text-stone-800">{qty}</span>
                        <button
                          onClick={() => bumpDefault(item.key, 1)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 text-white"
                          style={{ background: ACCENT }}
                          aria-label="増やす"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => bumpDefault(item.key, 1)}
                        className="px-3 h-8 rounded-lg bg-stone-100 text-stone-500 font-bold text-xs active:scale-95"
                      >
                        追加
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* フッター(戻る/次へ・始める) */}
      <div className="px-6 py-4 flex gap-3 border-t border-stone-200/70">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="px-5 py-3.5 rounded-2xl bg-white border border-stone-200 text-stone-600 font-bold active:scale-95 flex items-center gap-1"
          >
            <ArrowLeft size={18} /> 戻る
          </button>
        )}
        {isLast ? (
          <button
            onClick={finish}
            className="flex-1 py-3.5 rounded-2xl text-white font-black active:scale-95 flex items-center justify-center gap-2"
            style={{ background: ACCENT }}
          >
            <Check size={18} /> はじめる
          </button>
        ) : (
          <button
            onClick={() => canNext && setStep((s) => s + 1)}
            disabled={!canNext}
            className="flex-1 py-3.5 rounded-2xl text-white font-black active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: ACCENT }}
          >
            次へ <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
