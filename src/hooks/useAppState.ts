import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, Child, Item } from '../types';
import { DEFAULT_THRESHOLD, ITEMS } from '../constants';
import {
  createProvider,
  getStoredFamilyId,
  setStoredFamilyId,
  clearStoredFamilyId,
  generateFamilyId,
  type StorageProvider,
} from '../lib/storage';
import { uid } from '../lib/date';

function initialState(): AppState {
  const firstChild: Child = { id: uid(), name: '子ども1', items: {}, defaults: {} };
  return {
    children: [firstChild],
    currentChildId: firstChild.id,
    location: { name: '東京都' },
    weather: null,
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
  // 競合解決用に最新の updatedAt を ref で保持(リスナーの再登録を避ける)
  const updatedAtRef = useRef(0);
  // 現在の永続化 Provider(共有の有無で差し替わる)
  const providerRef = useRef<StorageProvider>(createProvider(null));

  // 初回ロード(familyId があればクラウドから取得)
  useEffect(() => {
    let active = true;
    (async () => {
      const fid = getStoredFamilyId();
      providerRef.current = createProvider(fid);
      const loaded = await providerRef.current.load();
      const next = loaded ?? initialState();
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

  // 保存(updatedAt を更新 → Provider へ)
  const save = useCallback((next: AppState) => {
    const stamped = { ...next, updatedAt: Date.now() };
    updatedAtRef.current = stamped.updatedAt;
    setState(stamped);
    void providerRef.current.save(stamped);
  }, []);

  // 画面復帰時に再読込(共有中はクラウドの最新を取り込む)
  useEffect(() => {
    if (loading) return;
    const onVisible = async () => {
      if (document.hidden) return;
      const remote = await providerRef.current.load();
      if (!remote) return;
      // 新しい方を採用(last-write-wins)
      if (remote.updatedAt > updatedAtRef.current) {
        updatedAtRef.current = remote.updatedAt;
        setState(remote);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loading]);

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

  const changeItem = useCallback(
    (key: string, delta: number) => {
      setState((s) => {
        if (!s) return s;
        const next = mapCurrentChild(s, (c) => {
          const items = { ...c.items };
          const v = Math.max(0, (items[key] || 0) + delta);
          if (v === 0) delete items[key];
          else items[key] = v;
          return { ...c, items };
        });
        save(next);
        return next;
      });
    },
    [mapCurrentChild, save]
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

  const saveCurrentAsDefault = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      const next = mapCurrentChild(s, (c) => ({ ...c, defaults: { ...c.items } }));
      save(next);
      return next;
    });
    showToast('現在の入力をデフォルトに保存しました');
  }, [mapCurrentChild, save, showToast]);

  const addChild = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      const newChild: Child = {
        id: uid(),
        name: `子ども${s.children.length + 1}`,
        items: {},
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

  const resetChild = useCallback(
    (id: string) => {
      setState((s) => {
        if (!s) return s;
        const next = {
          ...s,
          children: s.children.map((c) =>
            c.id === id ? { ...c, items: { ...c.defaults } } : c
          ),
        };
        save(next);
        return next;
      });
      showToast('デフォルトに戻しました');
    },
    [save, showToast]
  );

  const resetAll = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      const next = {
        ...s,
        children: s.children.map((c) => ({ ...c, items: { ...c.defaults } })),
      };
      save(next);
      return next;
    });
    showToast('全員デフォルトに戻しました');
  }, [save, showToast]);

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

  const setManualWeather = useCallback(
    (high: string, low: string, label: string) => {
      const h = high === '' ? null : Number(high);
      const l = low === '' ? null : Number(low);
      setState((s) => {
        if (!s) return s;
        const next: AppState = {
          ...s,
          weather: {
            high: h == null || !Number.isFinite(h) ? null : Math.round(h),
            low: l == null || !Number.isFinite(l) ? null : Math.round(l),
            label: label || '',
            source: 'manual',
            fetchedAt: Date.now(),
          },
        };
        save(next);
        return next;
      });
    },
    [save]
  );

  const clearWeather = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      const next = { ...s, weather: null };
      save(next);
      return next;
    });
  }, [save]);

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
          children: s.children.map((c) => ({
            ...c,
            items: strip(c.items),
            defaults: strip(c.defaults),
          })),
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
    showToast('この端末の共有を停止しました');
  }, [showToast]);

  /** 今すぐクラウドの最新を取得 */
  const syncNow = useCallback(async () => {
    const remote = await providerRef.current.load();
    if (remote && remote.updatedAt > updatedAtRef.current) {
      updatedAtRef.current = remote.updatedAt;
      setState(remote);
      showToast('最新データに更新しました');
    } else {
      showToast('すでに最新です');
    }
  }, [showToast]);

  return {
    state,
    loading,
    toast,
    showToast,
    familyId,
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
      setLocation,
      setThreshold,
      setManualWeather,
      clearWeather,
      addCustomItem,
      removeCustomItem,
      enableSharing,
      disableSharing,
      syncNow,
    },
  };
}
