import type { AppState } from '../types';
import { STORAGE_KEY } from '../constants';

/**
 * 永続化の抽象レイヤ。
 *
 * v1 は LocalStorageProvider のみ。将来、家族間共有を足すときは
 * KvStorageProvider(下記コメント参照)を実装して `storage` を差し替えるだけで、
 * useAppState / 各コンポーネントは一切変更不要。
 */
export interface StorageProvider {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
}

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
    updatedAt: data.updatedAt || 0,
  };
}

export class LocalStorageProvider implements StorageProvider {
  constructor(private key: string = STORAGE_KEY) {}

  async load(): Promise<AppState | null> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async save(state: AppState): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      // 容量超過などは黙って無視(UI 側の state は保持される)
    }
  }
}

/*
 * --- 将来の家族間共有(無料枠で完結)の実装メモ ---
 *
 * class KvStorageProvider implements StorageProvider {
 *   constructor(private familyId: string) {}
 *   async load() {
 *     const r = await fetch(`/api/state?f=${this.familyId}`);
 *     return r.ok ? migrate(await r.json()) : null;
 *   }
 *   async save(state: AppState) {
 *     await fetch(`/api/state?f=${this.familyId}`, {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(state),
 *     });
 *   }
 * }
 *
 * - /api/state.ts を Vercel Serverless Function として追加し、
 *   Upstash Redis(Vercel Marketplace の無料枠)に `family:<familyId>` キーで保存。
 * - familyId は URL クエリ(?f=xxxx)で家族に共有。
 * - 競合は updatedAt の大きい方を採用(last-write-wins)。
 */

/** v1 のデフォルト Provider */
export const storage: StorageProvider = new LocalStorageProvider();
