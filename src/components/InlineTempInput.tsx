import { useState } from 'react';
import { ACCENT } from '../constants';

interface Props {
  onSubmit: (high: string, low: string, label: string) => void;
}

const CONDITIONS = [
  { v: '晴れ', e: '☀️' },
  { v: 'くもり', e: '☁️' },
  { v: '雨', e: '🌧️' },
  { v: '雪', e: '❄️' },
];

/** 天気カード内で直接使うクイック気温入力 */
export default function InlineTempInput({ onSubmit }: Props) {
  const [high, setHigh] = useState('');
  const [low, setLow] = useState('');
  const [label, setLabel] = useState('');

  const empty = high === '' && low === '';

  const submit = () => {
    if (empty) return;
    onSubmit(high, low, label);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center bg-white rounded-xl border border-stone-200 px-3 py-2">
          <span className="text-[10px] text-stone-500 font-bold mr-2">最高</span>
          <input
            type="number"
            inputMode="decimal"
            value={high}
            onChange={(e) => setHigh(e.target.value)}
            placeholder="25"
            className="flex-1 bg-transparent text-stone-800 font-black text-lg w-full focus:outline-none"
          />
          <span className="text-xs text-stone-400">°C</span>
        </div>
        <div className="flex-1 flex items-center bg-white rounded-xl border border-stone-200 px-3 py-2">
          <span className="text-[10px] text-stone-500 font-bold mr-2">最低</span>
          <input
            type="number"
            inputMode="decimal"
            value={low}
            onChange={(e) => setLow(e.target.value)}
            placeholder="15"
            className="flex-1 bg-transparent text-stone-800 font-black text-lg w-full focus:outline-none"
          />
          <span className="text-xs text-stone-400">°C</span>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {CONDITIONS.map((c) => (
          <button
            key={c.v}
            onClick={() => setLabel(c.v)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold active:scale-95 transition-all flex items-center gap-1 ${
              label === c.v
                ? 'bg-stone-800 text-white'
                : 'bg-white text-stone-600 border border-stone-200'
            }`}
          >
            <span>{c.e}</span>
            <span>{c.v}</span>
          </button>
        ))}
      </div>
      <button
        onClick={submit}
        disabled={empty}
        className={`w-full py-2.5 rounded-xl text-white font-bold active:scale-95 transition-all ${
          empty ? 'bg-stone-300' : ''
        }`}
        style={!empty ? { background: ACCENT } : {}}
      >
        設定する
      </button>
    </div>
  );
}
