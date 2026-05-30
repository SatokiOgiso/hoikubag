import type { AppState } from '../types';
import { STORAGE_KEY } from '../constants';

/**
 * 永続化の抽象レイヤ。
 *
 * - 共有なし: LocalStorageProvider(この端末内のみ)
 * - 家族共有: KvStorageProvider(/api/state 経由で Upstash Redis に保存)
 *
 * 共有の有無は familyId(URL の ?f= または localStorage)で決まる。
 * useAppState / 各コンポーネントは StorageProvider インターフェースにのみ依存する。
 */
export interface StorageProvider {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
}

const FAMILY_ID_KEY = 'hoiku-family-id';

/** 読み込んだ生データに対する後方互換マイグレーション */
export function migrate(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<AppState>;
  if (!Array.isArray(data.children)) return null;

  const children = data.children.map((c) => ({
    ...c,
    items: c.items || {},
    defaults: c.defaults || {},
  }));

  return {
    children,
    currentChildId: data.currentChildId || children[0]?.id || '',
    location: data.location?.name ? data.location : { name: '東京都' },
    weather: data.weather ?? null,
    thresholdTemp: data.thresholdTemp ?? 23,
    customItems: Array.isArray(data.customItems) ? data.customItems : [],
    updatedAt: data.updatedAt || 0,
  };
}

// ---- localStorage(共有ありでもキャッシュ/オフライン用に使う)----
function readLocal(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 容量超過などは無視(メモリ上の state は保持される)
  }
}

/** localStorage キャッシュの読み出し(クラウド失敗時のフォールバック用に公開) */
export function loadLocalCache(): AppState | null {
  return readLocal();
}

export class LocalStorageProvider implements StorageProvider {
  async load(): Promise<AppState | null> {
    return readLocal();
  }
  async save(state: AppState): Promise<void> {
    writeLocal(state);
  }
}

/**
 * 家族共有: /api/state 経由でクラウドに読み書きしつつ localStorage にキャッシュ。
 * クラウド側の失敗(サーバー未設定・ネットワーク不通など)は **握りつぶさず throw** し、
 * 呼び出し側(useAppState)が同期エラーとしてユーザーに通知できるようにする。
 */
export class KvStorageProvider implements StorageProvider {
  constructor(private familyId: string) {}

  private url(): string {
    return `/api/state?f=${encodeURIComponent(this.familyId)}`;
  }

  async load(): Promise<AppState | null> {
    const r = await fetch(this.url());
    if (!r.ok) {
      throw new Error(`サーバー応答エラー (HTTP ${r.status})`);
    }
    const state = migrate(await r.json());
    if (state) writeLocal(state); // キャッシュ更新
    return state; // クラウドが空なら null
  }

  async save(state: AppState): Promise<void> {
    writeLocal(state); // 即時キャッシュ(オフライン時もローカルには残る)
    const r = await fetch(this.url(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!r.ok) {
      throw new Error(`サーバー応答エラー (HTTP ${r.status})`);
    }
  }
}

// ---- familyId 管理 ----

/** URL の ?f= を最優先(あれば永続化)、なければ localStorage の保存値 */
export function getStoredFamilyId(): string | null {
  try {
    const fromUrl = new URL(window.location.href).searchParams.get('f');
    if (fromUrl) {
      localStorage.setItem(FAMILY_ID_KEY, fromUrl);
      return fromUrl;
    }
  } catch {
    /* noop */
  }
  try {
    return localStorage.getItem(FAMILY_ID_KEY);
  } catch {
    return null;
  }
}

export function setStoredFamilyId(id: string): void {
  try {
    localStorage.setItem(FAMILY_ID_KEY, id);
  } catch {
    /* noop */
  }
}

export function clearStoredFamilyId(): void {
  try {
    localStorage.removeItem(FAMILY_ID_KEY);
  } catch {
    /* noop */
  }
}

/** 推測されにくい家族ID を生成 */
export function generateFamilyId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  );
}

/** 共有リンク(現在のURLに ?f= を付与) */
export function shareUrlFor(familyId: string): string {
  try {
    const u = new URL(window.location.href);
    u.searchParams.set('f', familyId);
    return u.toString();
  } catch {
    return `?f=${familyId}`;
  }
}

/** familyId の有無で適切な Provider を返す */
export function createProvider(familyId: string | null): StorageProvider {
  return familyId ? new KvStorageProvider(familyId) : new LocalStorageProvider();
}
