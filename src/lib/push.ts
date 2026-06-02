/**
 * Web Push 購読のクライアント側ヘルパー。
 *
 * iOS では「ホーム画面に追加した PWA」かつ通知許可済みの場合のみ動作する。
 * 公開鍵は VITE_VAPID_PUBLIC_KEY(ビルド時に注入)を使う。
 */

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** この端末/ブラウザが Web Push に対応しているか */
export function pushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** iOS でスタンドアロン(ホーム画面から起動)かどうか */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari 独自プロパティ
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** 現在の購読状態(購読中なら subscription を返す) */
export async function getSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * 通知を有効化する。許可ダイアログ → 購読 → サーバー登録まで。
 * familyId があれば紐づけて保存(共有家族は確定済みなら送信スキップできる)。
 */
export async function enablePush(familyId: string | null): Promise<void> {
  if (!pushSupported()) throw new Error('この端末は通知に対応していません');
  if (!PUBLIC_KEY) throw new Error('通知の設定(公開鍵)がサーバー側で未設定です');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('通知が許可されませんでした');

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
    }));

  const r = await fetch('/api/push?action=subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), familyId }),
  });
  if (!r.ok) throw new Error(`購読の登録に失敗しました (HTTP ${r.status})`);
}

/**
 * すでに通知を購読済みの端末について、保存されている familyId を現在の値へ更新する。
 * 通知許可は要求せず、購読が無ければ何もしない。
 * (通知を有効化した後に家族共有へ参加/作成した場合でも、家族向け通知が届くようにする)
 */
export async function syncSubscriptionFamily(familyId: string | null): Promise<void> {
  if (!pushSupported()) return;
  const sub = await getSubscription();
  if (!sub) return;
  await fetch('/api/push?action=subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), familyId }),
  });
}

/**
 * 家族へ「かばんの中身を確定して」とお願いの通知を送る。
 * 同じ familyId の購読すべて(自分の端末は除く)に届く。
 * 送信できた件数を返す。
 */
export async function requestFamilyConfirm(familyId: string): Promise<number> {
  const sub = await getSubscription();
  const r = await fetch('/api/push?action=notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyId, excludeEndpoint: sub?.endpoint ?? null }),
  });
  if (!r.ok) {
    let detail = `HTTP ${r.status}`;
    try {
      const err = (await r.json()) as { error?: string };
      if (err?.error) detail = err.error;
    } catch {
      /* JSON でなければステータスのみ */
    }
    throw new Error(`お願いの送信に失敗しました (${detail})`);
  }
  const data = (await r.json()) as { sent?: number };
  return data.sent ?? 0;
}

/** 通知を無効化する。サーバー登録解除 → ローカル購読解除 */
export async function disablePush(): Promise<void> {
  const sub = await getSubscription();
  if (!sub) return;
  try {
    await fetch('/api/push?action=unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } finally {
    await sub.unsubscribe();
  }
}
