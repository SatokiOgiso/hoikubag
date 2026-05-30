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
