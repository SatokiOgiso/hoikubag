import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, Child, Item } from '../types';
import { DEFAULT_THRESHOLD, ITEMS } from '../constants';
import {
  createProvider,
  getStoredFamilyId,
  setStoredFamilyId,
  clearStoredFamilyId,
  generateFamilyId,
  loadLocalCache,
  KvStorageProvider,
  type StorageProvider,
} from '../lib/storage';

import type { Forecast, DayBag } from '../types';
import { uid, jstDateOffset } from '../lib/date';
import { fetchForecast } from '../lib/weather';

export type SyncStatus = 'local' | 'ok' | 'error';

function initialState(): AppState {
  const firstChild: Child = { id: uid(), name: '子ども1', bags: {}, defaults: {} };
  return {
    children: [firstChild],
    currentChildId: firstChild.id,
    location: { name: '東京都' },
    thresholdTemp: DEFAULT_THRESHOLD,
    customItems: [],
    updatedAt: 0,
  };
}

export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  // 選択中の日付(YYYY-MM-DD)。既定は明日。揮発(同期しない)
  const [selectedDate, setSelectedDate] = useState<string>(() => jstDateOffset(1));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  // 天気は同期せずデバイスごとにアクセスのたび取得(揮発)
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  // 競合解決用に最新の updatedAt を ref で保持(リスナーの再登録を避ける)
  const updatedAtRef = useRef(0);
  // 非同期処理から最新の state を参照するための ref
  const stateRef = useRef<AppState | null>(null);
  // 現在の永続化 Provider(共有の有無で差し替わる)
  const providerRef = useRef<StorageProvider>(createProvider(null));

  const markSynced = () => {
    setSyncStatus('ok');
    setSyncError(null);
  };
  const markSyncError = (e: unknown) => {
    setSyncStatus('error');
    setSyncError(e instanceof Error ? e.message : String(e));
  };

  // 初回ロード(familyId があればクラウドから取得)
  useEffect(() => {
    let active = true;
    (async () => {
      const fid = getStoredFamilyId();
      providerRef.current = createProvider(fid);
      let next: AppState;
      try {
        const loaded = await providerRef.current.load();
        next = loaded ?? initialState();
        if (fid) markSynced();
      } catch (e) {
        // クラウド取得に失敗 → ローカルキャッシュで起動しつつエラーを記録
        next = loadLocalCache() ?? initialState();
        if (fid) markSyncError(e);
      }
      if (!active) return;
      updatedAtRef.current = next.updatedAt;
      setFamilyId(fid);
      setState(next);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // 保存(updatedAt を更新 → Provider へ)。共有中は同期成否を syncStatus に反映
  const save = useCallback((next: AppState) => {
    const stamped = { ...next, updatedAt: Date.now() };
    updatedAtRef.current = stamped.updatedAt;
    setState(stamped);
    const cloud = providerRef.current instanceof KvStorageProvider;
    providerRef.current
      .save(stamped)
      .then(() => {
        if (cloud) markSynced();
      })
      .catch((e) => {
        if (cloud) markSyncError(e);
      });
  }, []);

  // 画面復帰時に再読込(共有中はクラウドの最新を取り込む)
  useEffect(() => {
    if (loading) return;
    const onVisible = async () => {
      if (document.hidden) return;
      const cloud = providerRef.current instanceof KvStorageProvider;
      try {
        const remote = await providerRef.current.load();
        if (cloud) markSynced();
        if (!remote) return;
        // 新しい方を採用(last-write-wins)
        if (remote.updatedAt > updatedAtRef.current) {
          updatedAtRef.current = remote.updatedAt;
          setState(remote);
        }
      } catch (e) {
        if (cloud) markSyncError(e);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loading]);

  // 非同期処理(天気取得など)が最新 state を参照できるようにする
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // ---- 現在の子どもの items / defaults を編集するヘルパー ----
  const mapCurrentChild = useCallback(
    (s: AppState, fn: (c: Child) => Child): AppState => ({
      ...s,
      children: s.children.map((c) => (c.id === s.currentChildId ? fn(c) : c)),
    }),
    []
  );

  // 現在の子どもの「選択中の日付」のかばんを更新する
  const mapCurrentBag = useCallback(
    (s: AppState, date: string, fn: (b: DayBag) => DayBag): AppState =>
      mapCurrentChild(s, (c) => {
        const bag = c.bags?.[date] ?? { items: {}, confirmed: false };
        const nextBag = fn({ items: { ...bag.items }, confirmed: bag.confirmed });
        const bags = { ...c.bags };
        // 空かつ未確定のかばんは保持しない(肥大化を避ける)
        if (Object.keys(nextBag.items).length === 0 && !nextBag.confirmed) {
          delete bags[date];
        } else {
          bags[date] = nextBag;
        }
        return { ...c, bags };
      }),
    [mapCurrentChild]
  );

  const changeItem = useCallback(
    (date: string, key: string, delta: number) => {
      setState((s) => {
        if (!s) return s;
        const next = mapCurrentBag(s, date, (b) => {
          const items = { ...b.items };
          const v = Math.max(0, (items[key] || 0) + delta);
          if (v === 0) delete items[key];
          else items[key] = v;
          // 確定後に内容を変えたら確定を解除する
          return { items, confirmed: false };
        });
        save(next);
        return next;
      });
    },
    [mapCurrentBag, save]
  );

  /** 現在の子ども・指定日の確定状態をトグル */
  const toggleConfirm = useCallback(
    (date: string) => {
      setState((s) => {
        if (!s) return s;
        const next = mapCurrentBag(s, date, (b) => ({ ...b, confirmed: !b.confirmed }));
        save(next);
        return next;
      });
    },
    [mapCurrentBag, save]
  );

  const changeDefault = useCallback(
    (key: string, delta: number) => {
      setState((s) => {
        if (!s) return s;
        const next = mapCurrentChild(s, (c) => {
          const defaults = { ...c.defaults };
          const v = Math.max(0, (defaults[key] || 0) + delta);
          if (v === 0) delete defaults[key];
          else defaults[key] = v;
          return { ...c, defaults };
        });
        save(next);
        return next;
      });
    },
    [mapCurrentChild, save]
  );

  /** 指定日のかばんの内容をデフォルトとして保存 */
  const saveCurrentAsDefault = useCallback(
    (date: string) => {
      setState((s) => {
        if (!s) return s;
        const next = mapCurrentChild(s, (c) => ({
          ...c,
          defaults: { ...(c.bags?.[date]?.items ?? {}) },
        }));
        save(next);
        return next;
      });
      showToast('現在の入力をデフォルトに保存しました');
    },
    [mapCurrentChild, save, showToast]
  );

  const addChild = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      const newChild: Child = {
        id: uid(),
        name: `子ども${s.children.length + 1}`,
        bags: {},
        defaults: {},
      };
      const next = { ...s, children: [...s.children, newChild], currentChildId: newChild.id };
      save(next);
      return next;
    });
  }, [save]);

  const renameChild = useCallback(
    (id: string, name: string) => {
      setState((s) => {
        if (!s) return s;
        const next = {
          ...s,
          children: s.children.map((c) => (c.id === id ? { ...c, name } : c)),
        };
        save(next);
        return next;
      });
    },
    [save]
  );

  const removeChild = useCallback(
    (id: string) => {
      setState((s) => {
        if (!s) return s;
        if (s.children.length <= 1) {
          showToast('最低1人は必要です');
          return s;
        }
        const remaining = s.children.filter((c) => c.id !== id);
        const next = {
          ...s,
          children: remaining,
          currentChildId: s.currentChildId === id ? remaining[0].id : s.currentChildId,
        };
        save(next);
        return next;
      });
    },
    [save, showToast]
  );

  const selectChild = useCallback(
    (id: string) => {
      setState((s) => {
        if (!s) return s;
        const next = { ...s, currentChildId: id };
        save(next);
        return next;
      });
    },
    [save]
  );

  /** 指定日の指定子どものかばんをデフォルトに戻す */
  const resetChild = useCallback(
    (date: string, id: string) => {
      setState((s) => {
        if (!s) return s;
        const next = {
          ...s,
          children: s.children.map((c) =>
            c.id === id
              ? { ...c, bags: { ...c.bags, [date]: { items: { ...c.defaults }, confirmed: false } } }
              : c
          ),
        };
        save(next);
        return next;
      });
      showToast('デフォルトに戻しました');
    },
    [save, showToast]
  );

  /** 指定日の全員のかばんをデフォルトに戻す */
  const resetAll = useCallback(
    (date: string) => {
      setState((s) => {
        if (!s) return s;
        const next = {
          ...s,
          children: s.children.map((c) => ({
            ...c,
            bags: { ...c.bags, [date]: { items: { ...c.defaults }, confirmed: false } },
          })),
        };
        save(next);
        return next;
      });
      showToast('全員デフォルトに戻しました');
    },
    [save, showToast]
  );

  const setLocation = useCallback(
    (name: string) => {
      setState((s) => {
        if (!s) return s;
        const next = { ...s, location: { name } };
        save(next);
        return next;
      });
    },
    [save]
  );

  const setThreshold = useCallback(
    (thresholdTemp: number) => {
      setState((s) => {
        if (!s) return s;
        const next = { ...s, thresholdTemp };
        save(next);
        return next;
      });
    },
    [save]
  );

  /** 天気を取得(同期せずローカル state にのみ反映) */
  const fetchWeather = useCallback(async (name?: string) => {
    const loc = name ?? stateRef.current?.location?.name;
    if (!loc) {
      setWeatherError('地域が設定されていません');
      return;
    }
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      setForecast(await fetchForecast(loc));
    } catch (e) {
      setWeatherError(e instanceof Error ? e.message : String(e));
    }
    setWeatherLoading(false);
  }, []);

  // アクセス毎(マウント後)+ 地域変更時に自動取得
  const locationName = state?.location?.name;
  useEffect(() => {
    if (loading || !locationName) return;
    void fetchWeather(locationName);
  }, [loading, locationName, fetchWeather]);

  // ---- 品目のカスタマイズ ----

  /** リストにない品目(バスタオルなど)を追加。成功すれば true */
  const addCustomItem = useCallback(
    (name: string, emoji: string): boolean => {
      const key = name.trim();
      if (!key) {
        showToast('品目名を入力してください');
        return false;
      }
      const exists =
        ITEMS.some((i) => i.key === key) ||
        (state?.customItems || []).some((i) => i.key === key);
      if (exists) {
        showToast('同じ名前の品目があります');
        return false;
      }
      setState((s) => {
        if (!s) return s;
        const item: Item = { key, emoji: emoji || '📦' };
        const next = { ...s, customItems: [...s.customItems, item] };
        save(next);
        return next;
      });
      showToast(`「${key}」を追加しました`);
      return true;
    },
    [state?.customItems, save, showToast]
  );

  /** 追加した品目を削除(全員の items / defaults からも取り除く) */
  const removeCustomItem = useCallback(
    (key: string) => {
      setState((s) => {
        if (!s) return s;
        const strip = (rec: Record<string, number>) => {
          if (!(key in rec)) return rec;
          const copy = { ...rec };
          delete copy[key];
          return copy;
        };
        const next: AppState = {
          ...s,
          customItems: s.customItems.filter((i) => i.key !== key),
          children: s.children.map((c) => {
            // すべての日付のかばんから取り除く
            const bags: Record<string, DayBag> = {};
            for (const [d, bag] of Object.entries(c.bags || {})) {
              bags[d] = { items: strip(bag.items), confirmed: bag.confirmed };
            }
            return { ...c, bags, defaults: strip(c.defaults) };
          }),
        };
        save(next);
        return next;
      });
    },
    [save]
  );

  // ---- 家族共有 ----

  /** 共有を開始: 新しい familyId を発行し、現在のデータをクラウドへアップロード */
  const enableSharing = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      const fid = generateFamilyId();
      setStoredFamilyId(fid);
      providerRef.current = createProvider(fid);
      setFamilyId(fid);
      save(s); // 現在の状態をクラウドへ(save 内で updatedAt 更新 + アップロード)
      showToast('家族共有を開始しました');
      return s;
    });
  }, [save, showToast]);

  /** 共有を停止: この端末を共有から外す(クラウドのデータは保持) */
  const disableSharing = useCallback(() => {
    clearStoredFamilyId();
    providerRef.current = createProvider(null);
    setFamilyId(null);
    setSyncStatus('local');
    setSyncError(null);
    showToast('この端末の共有を停止しました');
  }, [showToast]);

  /** 今すぐクラウドの最新を取得 */
  const syncNow = useCallback(async () => {
    const cloud = providerRef.current instanceof KvStorageProvider;
    try {
      const remote = await providerRef.current.load();
      if (cloud) markSynced();
      if (remote && remote.updatedAt > updatedAtRef.current) {
        updatedAtRef.current = remote.updatedAt;
        setState(remote);
        showToast('最新データに更新しました');
      } else {
        showToast('すでに最新です');
      }
    } catch (e) {
      if (cloud) markSyncError(e);
      showToast('同期に失敗しました');
    }
  }, [showToast]);

  return {
    state,
    loading,
    toast,
    showToast,
    familyId,
    syncStatus,
    syncError,
    forecast,
    weatherLoading,
    weatherError,
    selectedDate,
    setSelectedDate,
    actions: {
      changeItem,
      changeDefault,
      saveCurrentAsDefault,
      addChild,
      renameChild,
      removeChild,
      selectChild,
      resetChild,
      resetAll,
      toggleConfirm,
      setLocation,
      setThreshold,
      fetchWeather,
      addCustomItem,
      removeCustomItem,
      enableSharing,
      disableSharing,
      syncNow,
    },
  };
}
