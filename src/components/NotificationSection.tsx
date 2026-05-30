import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  pushSupported,
  isStandalone,
  getSubscription,
  enablePush,
  disablePush,
} from '../lib/push';

interface Props {
  familyId: string | null;
  showToast: (msg: string) => void;
}

/** 準備リマインド通知の ON/OFF。iOS はホーム画面追加が前提。 */
export default function NotificationSection({ familyId, showToast }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  const supported = pushSupported();
  // iOS Safari のタブでは通知不可。ホーム画面に追加が必要。
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const needsInstall = isiOS && !isStandalone();

  useEffect(() => {
    (async () => {
      if (supported) {
        const sub = await getSubscription();
        setEnabled(!!sub);
      }
      setChecked(true);
    })();
  }, [supported]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        showToast('通知をオフにしました');
      } else {
        await enablePush(familyId);
        setEnabled(true);
        showToast('通知をオンにしました');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '通知の設定に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className="text-sm font-bold text-stone-700 mb-2">🔔 準備リマインド通知</h3>
      <div className="text-xs text-stone-500 mb-2 leading-relaxed">
        毎日夕方18時ごろ「明日のかばんの中身を確定しましたか?」とお知らせします。
        {familyId
          ? '家族全員が確定済みの日は届きません。'
          : '家族共有を有効にすると、確定済みの日は届かなくなります。'}
      </div>

      {!supported ? (
        <div className="bg-white rounded-xl border border-stone-200 px-3 py-2.5 text-xs text-stone-400">
          この端末/ブラウザは通知に対応していません。
        </div>
      ) : needsInstall ? (
        <div className="bg-amber-50 rounded-xl border border-amber-200 px-3 py-2.5 text-xs text-amber-700 leading-relaxed">
          通知を使うには、Safari の共有メニューから
          <span className="font-bold">「ホーム画面に追加」</span>
          して、追加したアプリから開いてください。
        </div>
      ) : (
        <button
          onClick={toggle}
          disabled={busy || !checked}
          className={`w-full rounded-xl py-3 border font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 ${
            enabled
              ? 'bg-white border-stone-200 text-stone-500 hover:bg-red-50 hover:text-red-600'
              : 'bg-white border-stone-300 text-stone-800'
          }`}
        >
          {enabled ? <BellOff size={16} /> : <Bell size={16} />}
          {busy ? '処理中…' : enabled ? '通知をオフにする' : '通知をオンにする'}
        </button>
      )}
    </section>
  );
}
