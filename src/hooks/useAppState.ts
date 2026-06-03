import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, Child, Item, RecurringItem, PrepTask } from '../types';
import { DEFAULT_THRESHOLD, DEFAULT_CLOSED_WEEKDAYS, DEFAULT_ROLLOVER, ITEMS } from '../constants';
import { matchesRecurring, appliesDefaults } from '../lib/recurring';
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
import { uid, jstDateOffset, jstWeekdayNum, nextDaycareDay, defaultSelectedDate } from '../lib/date';
import { fetchForecast } from '../lib/weather';

export type SyncStatus = 'local' | 'ok' | 'error';

/** トースト。undo があれば「元に戻す」ボタンを表示する */
export interface ToastState {
  id: number;
  message: string;
  undo?: () => void;
}

function initialState(): AppState {
  const firstChild: Child = { id: uid(), name: '子ども1', bags: {}, defaults: {} };
  return {
    children: [firstChild],
    currentChildId: firstChild.id,
    location: { name: '東京都' },
    thresholdTemp: DEFAULT_THRESHOLD,
    customItems: [],
    closedWeekdays: DEFAULT_CLOSED_WEEKDAYS,
    rolloverMinutes: DEFAULT_ROLLOVER,
    updatedAt: 0,
  };
}

export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
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
  // 画面復帰時の日付またぎ検知用に、最後に見た JST の「今日」を保持
  const todayRef = useRef<string>(jstDateOffset(0));
  // 最後に算出した既定の選択日(切り替え時刻またぎを検知して追従するため)
  const defaultRef = useRef<string>('');
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
      // 切り替え時刻を踏まえた既定の選択日を初期表示
      const closed = next.closedWeekdays ?? DEFAULT_CLOSED_WEEKDAYS;
      const initialDefault = defaultSelectedDate(closed, next.rolloverMinutes ?? DEFAULT_ROLLOVER);
      defaultRef.current = initialDefault;
      setSelectedDate(initialDefault);
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
      const closed = stateRef.current?.closedWeekdays ?? DEFAULT_CLOSED_WEEKDAYS;
      const rollover = stateRef.current?.rolloverMinutes ?? DEFAULT_ROLLOVER;
      const nowToday = jstDateOffset(0);
      // 暦日をまたいでいたら天気を取り直す
      if (nowToday !== todayRef.current) {
        todayRef.current = nowToday;
        void fetchWeather();
      }
      // 既定日(暦日 or 切り替え時刻)が変わったら、既定のまま/過去日のときは追従して進める
      const nextDefault = defaultSelectedDate(closed, rollover);
      if (nextDefault !== defaultRef.current) {
        const prevDefault = defaultRef.current;
        defaultRef.current = nextDefault;
        setSelectedDate((prev) => (prev === prevDefault || prev < nowToday ? nextDefault : prev));
      }
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

  // 表示中トーストの自動消去タイマー(新しいトーストが来たら前のを止める)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, message: msg, undo });
    // 「元に戻す」付きは押す猶予を長めに
    toastTimer.current = setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, undo ? 6000 : 2000);
  }, []);

  /** 直前のスナップショットへ復元する「元に戻す」を作る */
  const makeUndo = useCallback(
    (snapshot: AppState) => () => {
      save(snapshot);
      showToast('元に戻しました');
    },
    [save, showToast]
  );

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
        const nextBag = fn({
          items: { ...bag.items },
          confirmed: bag.confirmed,
          notes: bag.notes ? [...bag.notes] : undefined,
          itemNotes: bag.itemNotes ? { ...bag.itemNotes } : undefined,
          dayMemo: bag.dayMemo,
          updatedAt: bag.updatedAt,
        });
        const bags = { ...c.bags };
        // 空かつ未確定かつメモ類なしのかばんは保持しない(肥大化を避ける)
        const hasNotes = nextBag.notes && nextBag.notes.length > 0;
        const hasItemNotes =
          nextBag.itemNotes && Object.values(nextBag.itemNotes).some((v) => v.trim());
        const hasDayMemo = !!nextBag.dayMemo?.trim();
        if (
          Object.keys(nextBag.items).length === 0 &&
          !nextBag.confirmed &&
          !hasNotes &&
          !hasItemNotes &&
          !hasDayMemo
        ) {
          delete bags[date];
        } else {
          // この日の編集日時を記録
          bags[date] = { ...nextBag, updatedAt: Date.now() };
        }
        return { ...c, bags };
      }),
    [mapCurrentChild]
  );

  const changeItem = useCallback(
    (date: string, key: string, delta: number, effectiveBase?: number) => {
      setState((s) => {
        if (!s) return s;
        const currentChild = s.children.find((c) => c.id === s.currentChildId);
        const hasRecurring = (currentChild?.recurringItems ?? []).some(
          (r) => r.itemKey === key && matchesRecurring(r, date)
        );
        // この日にデフォルトが下敷きとして効く項目か(今日以降の登園日 かつ defaults に含む)
        const hasDefault =
          (currentChild?.defaults?.[key] ?? 0) > 0 &&
          appliesDefaults(date, s.closedWeekdays ?? DEFAULT_CLOSED_WEEKDAYS);
        const next = mapCurrentBag(s, date, (b) => {
          const items = { ...b.items };
          const current = effectiveBase !== undefined ? effectiveBase : (items[key] || 0);
          const v = Math.max(0, current + delta);
          if (v === 0 && (hasRecurring || hasDefault)) {
            // 定期/デフォルト品目を明示的にゼロにするセンチネル(下敷きが復活しないようにする)
            items[key] = 0;
          } else if (v === 0) {
            delete items[key];
          } else {
            items[key] = v;
          }
          // 確定後に内容を変えたら確定を解除する(メモ類は引き継ぐ)
          return { ...b, items, confirmed: false };
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
      const prev = stateRef.current;
      if (!prev) return;
      const next = mapCurrentChild(prev, (c) => ({
        ...c,
        defaults: { ...(c.bags?.[date]?.items ?? {}) },
      }));
      save(next);
      showToast('現在の入力をデフォルトに保存しました', makeUndo(prev));
    },
    [mapCurrentChild, save, showToast, makeUndo]
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
      const prev = stateRef.current;
      if (!prev) return;
      if (prev.children.length <= 1) {
        showToast('最低1人は必要です');
        return;
      }
      const removedName = prev.children.find((c) => c.id === id)?.name ?? '';
      const remaining = prev.children.filter((c) => c.id !== id);
      const next = {
        ...prev,
        children: remaining,
        currentChildId: prev.currentChildId === id ? remaining[0].id : prev.currentChildId,
      };
      save(next);
      showToast(`「${removedName}」を削除しました`, makeUndo(prev));
    },
    [save, showToast, makeUndo]
  );

  const selectChild = useCallback(
    (id: string) => {
      const current = stateRef.current;
      if (!current || current.currentChildId === id) return;
      save({ ...current, currentChildId: id });
    },
    [save]
  );

  /** 指定日の指定子どものかばんをデフォルトに戻す */
  const resetChild = useCallback(
    (date: string, id: string) => {
      const prev = stateRef.current;
      if (!prev) return;
      const next = {
        ...prev,
        children: prev.children.map((c) =>
          c.id === id
            ? {
                ...c,
                bags: {
                  ...c.bags,
                  [date]: { items: { ...c.defaults }, confirmed: false, updatedAt: Date.now() },
                },
              }
            : c
        ),
      };
      save(next);
      showToast('デフォルトに戻しました', makeUndo(prev));
    },
    [save, showToast, makeUndo]
  );

  /** 指定日の全員のかばんをデフォルトに戻す */
  const resetAll = useCallback(
    (date: string) => {
      const prev = stateRef.current;
      if (!prev) return;
      const next = {
        ...prev,
        children: prev.children.map((c) => ({
          ...c,
          bags: {
            ...c.bags,
            [date]: { items: { ...c.defaults }, confirmed: false, updatedAt: Date.now() },
          },
        })),
      };
      save(next);
      showToast('全員デフォルトに戻しました', makeUndo(prev));
    },
    [save, showToast, makeUndo]
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

  /** 表示の切り替え時刻(0時からの分)を設定 */
  const setRolloverMinutes = useCallback(
    (rolloverMinutes: number) => {
      setState((s) => {
        if (!s) return s;
        const next = { ...s, rolloverMinutes };
        save(next);
        return next;
      });
    },
    [save]
  );

  const changeNotes = useCallback(
    (date: string, notes: string[]) => {
      setState((s) => {
        if (!s) return s;
        const next = mapCurrentBag(s, date, (b) => ({ ...b, notes }));
        save(next);
        return next;
      });
    },
    [mapCurrentBag, save]
  );

  /** 品目ごとのメモ(普段と違う個数の理由など)を設定。空文字でそのキーを削除 */
  const changeItemNote = useCallback(
    (date: string, key: string, note: string) => {
      setState((s) => {
        if (!s) return s;
        const next = mapCurrentBag(s, date, (b) => {
          const itemNotes = { ...(b.itemNotes ?? {}) };
          if (note.trim()) itemNotes[key] = note;
          else delete itemNotes[key];
          return { ...b, itemNotes };
        });
        save(next);
        return next;
      });
    },
    [mapCurrentBag, save]
  );

  /** その日全体のメモを設定 */
  const changeDayMemo = useCallback(
    (date: string, memo: string) => {
      setState((s) => {
        if (!s) return s;
        const next = mapCurrentBag(s, date, (b) => ({ ...b, dayMemo: memo }));
        save(next);
        return next;
      });
    },
    [mapCurrentBag, save]
  );

  const copyBag = useCallback(
    (childId: string, fromDate: string, toDates: string[]) => {
      const prev = stateRef.current;
      if (!prev) return;
      const child = prev.children.find((c) => c.id === childId);
      if (!child) return;
      const fromItems = child.bags?.[fromDate]?.items ?? {};
      const next: AppState = {
        ...prev,
        children: prev.children.map((c) => {
          if (c.id !== childId) return c;
          const bags = { ...c.bags };
          const now = Date.now();
          for (const d of toDates) {
            bags[d] = { items: { ...fromItems }, confirmed: false, updatedAt: now };
          }
          return { ...c, bags };
        }),
      };
      save(next);
      const label =
        toDates.length === 1
          ? toDates[0].slice(5).replace('-', '/') + 'にコピーしました'
          : `${toDates.length}日にコピーしました`;
      showToast(label, makeUndo(prev));
    },
    [save, showToast, makeUndo]
  );

  const setClosedWeekdays = useCallback(
    (closedWeekdays: number[]) => {
      setState((s) => {
        if (!s) return s;
        const next = { ...s, closedWeekdays };
        save(next);
        return next;
      });
      // 現在の選択日が休みになった場合は次の登園日へ移動
      setSelectedDate((prev) => {
        if (closedWeekdays.includes(jstWeekdayNum(prev))) {
          return nextDaycareDay(closedWeekdays);
        }
        return prev;
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
      const prev = stateRef.current;
      if (!prev) return;
      const strip = (rec: Record<string, number>) => {
        if (!(key in rec)) return rec;
        const copy = { ...rec };
        delete copy[key];
        return copy;
      };
      const next: AppState = {
        ...prev,
        customItems: prev.customItems.filter((i) => i.key !== key),
        children: prev.children.map((c) => {
          // すべての日付のかばんから取り除く
          const bags: Record<string, DayBag> = {};
          for (const [d, bag] of Object.entries(c.bags || {})) {
            bags[d] = { items: strip(bag.items), confirmed: bag.confirmed };
          }
          return { ...c, bags, defaults: strip(c.defaults) };
        }),
      };
      save(next);
      showToast(`「${key}」を削除しました`, makeUndo(prev));
    },
    [save, showToast, makeUndo]
  );

  // ---- 定期的な持ち物 ----

  const addRecurringItem = useCallback(
    (childId: string, rule: Omit<RecurringItem, 'id'>): boolean => {
      if (!rule.itemKey.trim()) {
        showToast('品目を選択してください');
        return false;
      }
      setState((s) => {
        if (!s) return s;
        const newRule: RecurringItem = { ...rule, id: uid() };
        const next: AppState = {
          ...s,
          children: s.children.map((c) =>
            c.id === childId
              ? { ...c, recurringItems: [...(c.recurringItems ?? []), newRule] }
              : c
          ),
        };
        save(next);
        return next;
      });
      showToast('定期的な持ち物を追加しました');
      return true;
    },
    [save, showToast]
  );

  const updateRecurringItem = useCallback(
    (childId: string, rule: RecurringItem) => {
      setState((s) => {
        if (!s) return s;
        const next: AppState = {
          ...s,
          children: s.children.map((c) =>
            c.id === childId
              ? {
                  ...c,
                  recurringItems: (c.recurringItems ?? []).map((r) =>
                    r.id === rule.id ? rule : r
                  ),
                }
              : c
          ),
        };
        save(next);
        return next;
      });
    },
    [save]
  );

  const removeRecurringItem = useCallback(
    (childId: string, ruleId: string) => {
      const prev = stateRef.current;
      if (!prev) return;
      const next: AppState = {
        ...prev,
        children: prev.children.map((c) =>
          c.id === childId
            ? { ...c, recurringItems: (c.recurringItems ?? []).filter((r) => r.id !== ruleId) }
            : c
        ),
      };
      save(next);
      showToast('定期的な持ち物を削除しました', makeUndo(prev));
    },
    [save, showToast, makeUndo]
  );

  // ---- 準備リスト(買い物・提出物・やること)----

  const addTask = useCallback(
    (input: Omit<PrepTask, 'id' | 'createdAt' | 'updatedAt'>): boolean => {
      if (!input.title.trim()) {
        showToast('タイトルを入力してください');
        return false;
      }
      setState((s) => {
        if (!s) return s;
        const now = Date.now();
        const task: PrepTask = {
          ...input,
          title: input.title.trim(),
          id: uid(),
          createdAt: now,
          updatedAt: now,
        };
        const next: AppState = { ...s, tasks: [...(s.tasks ?? []), task] };
        save(next);
        return next;
      });
      showToast('準備リストに追加しました');
      return true;
    },
    [save, showToast]
  );

  const updateTask = useCallback(
    (task: PrepTask) => {
      setState((s) => {
        if (!s) return s;
        const next: AppState = {
          ...s,
          tasks: (s.tasks ?? []).map((t) =>
            t.id === task.id ? { ...task, title: task.title.trim(), updatedAt: Date.now() } : t
          ),
        };
        save(next);
        return next;
      });
    },
    [save]
  );

  const removeTask = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      if (!prev) return;
      const removed = (prev.tasks ?? []).find((t) => t.id === id);
      const next: AppState = {
        ...prev,
        tasks: (prev.tasks ?? []).filter((t) => t.id !== id),
      };
      save(next);
      showToast(`「${removed?.title ?? ''}」を削除しました`, makeUndo(prev));
    },
    [save, showToast, makeUndo]
  );

  const toggleTaskDone = useCallback(
    (id: string) => {
      setState((s) => {
        if (!s) return s;
        const next: AppState = {
          ...s,
          tasks: (s.tasks ?? []).map((t) =>
            t.id === id ? { ...t, done: !t.done, updatedAt: Date.now() } : t
          ),
        };
        save(next);
        return next;
      });
    },
    [save]
  );

  /** 「✋ 私がやる」/「手を下ろす」。空文字で担当をクリア */
  const setTaskAssignee = useCallback(
    (id: string, name: string) => {
      setState((s) => {
        if (!s) return s;
        const assignee = name.trim();
        const next: AppState = {
          ...s,
          tasks: (s.tasks ?? []).map((t) =>
            t.id === id ? { ...t, assignee: assignee || undefined, updatedAt: Date.now() } : t
          ),
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

  /** 既存の共有に参加: 招待URL または familyId を受け取り、クラウドのデータをロード */
  const joinFamily = useCallback(async (input: string): Promise<boolean> => {
    let fid = input.trim();
    try {
      const u = new URL(fid);
      fid = u.searchParams.get('f') ?? fid;
    } catch {
      // URLでなければそのまま familyId として扱う
    }
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(fid)) {
      showToast('招待コードが正しくありません');
      return false;
    }
    const provider = new KvStorageProvider(fid);
    try {
      const remote = await provider.load();
      if (!remote) {
        showToast('データが見つかりませんでした');
        return false;
      }
      setStoredFamilyId(fid);
      providerRef.current = provider;
      setFamilyId(fid);
      updatedAtRef.current = remote.updatedAt;
      setState(remote);
      markSynced();
      showToast('家族の共有データに接続しました');
      return true;
    } catch (e) {
      markSyncError(e);
      showToast('接続に失敗しました');
      return false;
    }
  }, [showToast]);

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

  // ---- オンボーディング ----

  /** 初回設定をまとめて反映(子どもの名前・地域・デフォルト持ち物を1回で保存) */
  const applyOnboarding = useCallback(
    (data: { childNames: string[]; location: string; defaults: Record<string, number> }) => {
      const prev = stateRef.current;
      if (!prev) return;
      const names = data.childNames.map((n) => n.trim()).filter(Boolean);
      const finalNames = names.length > 0 ? names : prev.children.map((c) => c.name);
      // 既存の子ども(id)はできるだけ再利用し、足りない分は新規作成
      const children: Child[] = finalNames.map((name, i) => {
        const existing = prev.children[i];
        return existing
          ? { ...existing, name, defaults: { ...data.defaults } }
          : { id: uid(), name, bags: {}, defaults: { ...data.defaults } };
      });
      const next: AppState = {
        ...prev,
        children,
        currentChildId: children[0].id,
        location: { name: data.location.trim() || prev.location.name },
      };
      save(next);
    },
    [save]
  );

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
      setRolloverMinutes,
      changeNotes,
      changeItemNote,
      changeDayMemo,
      copyBag,
      setClosedWeekdays,
      fetchWeather,
      addCustomItem,
      removeCustomItem,
      addRecurringItem,
      updateRecurringItem,
      removeRecurringItem,
      addTask,
      updateTask,
      removeTask,
      toggleTaskDone,
      setTaskAssignee,
      enableSharing,
      joinFamily,
      disableSharing,
      syncNow,
      applyOnboarding,
    },
  };
}
