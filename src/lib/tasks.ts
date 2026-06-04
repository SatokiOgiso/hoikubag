import type { PrepTask, TaskKind } from '../types';
import { jstDateOffset } from './date';

/** 期限が「間近」とみなす日数(今日を含めてこの日数以内なら soon) */
export const SOON_DAYS = 3;

export type TaskUrgency = 'overdue' | 'soon' | 'normal' | 'none';

/**
 * タスクの緊急度を返す(JST基準)。
 * - 完了済み or 期限なし → 'none'
 * - 期限が今日より前 → 'overdue'
 * - 期限が今日〜SOON_DAYS日後 → 'soon'
 * - それ以降 → 'normal'
 */
export function taskUrgency(task: PrepTask, today: string = jstDateOffset(0)): TaskUrgency {
  if (task.done || !task.dueDate) return 'none';
  if (task.dueDate < today) return 'overdue';
  const soonLimit = jstDateOffset(SOON_DAYS);
  if (task.dueDate <= soonLimit) return 'soon';
  return 'normal';
}

/** 未完了タスクの件数 */
export function incompleteTaskCount(tasks: PrepTask[]): number {
  return tasks.filter((t) => !t.done).length;
}

/** 種別ごとの未完了件数 */
export function incompleteCountsByKind(tasks: PrepTask[]): Record<TaskKind, number> {
  const counts: Record<TaskKind, number> = { buy: 0, submit: 0, other: 0 };
  for (const t of tasks) {
    if (!t.done) counts[t.kind]++;
  }
  return counts;
}

/** 期限切れ/間近の未完了タスクがあるか(バッジを目立たせる判定に使う) */
export function hasUrgentTask(tasks: PrepTask[], today: string = jstDateOffset(0)): boolean {
  return tasks.some((t) => {
    const u = taskUrgency(t, today);
    return u === 'overdue' || u === 'soon';
  });
}

/** 期限切れ/間近の未完了タスクの件数 */
export function urgentTaskCount(tasks: PrepTask[], today: string = jstDateOffset(0)): number {
  return tasks.filter((t) => {
    const u = taskUrgency(t, today);
    return u === 'overdue' || u === 'soon';
  }).length;
}

/** 期限までの残り日数(JST基準)。過去なら負。期限なしは null */
export function daysUntilDue(dueDate: string | undefined, today: string = jstDateOffset(0)): number | null {
  if (!dueDate) return null;
  const a = Date.parse(today + 'T00:00:00Z');
  const b = Date.parse(dueDate + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

/** 期限の表示ラベル。例: "今日まで" "期限切れ(2日)" "あと3日 · 6/6" "6/20まで" */
export function dueLabel(dueDate: string | undefined, today: string = jstDateOffset(0)): string {
  if (!dueDate) return '';
  const days = daysUntilDue(dueDate, today);
  const [, mm, dd] = dueDate.split('-');
  const md = `${Number(mm)}/${Number(dd)}`;
  if (days == null) return '';
  if (days < 0) return `期限切れ ${md}`;
  if (days === 0) return `今日まで ${md}`;
  if (days === 1) return `明日まで ${md}`;
  if (days <= SOON_DAYS) return `あと${days}日 ${md}`;
  return `${md}まで`;
}

/** 「いつやる」予定日の表示ラベル。例: "今日やる" "明日やる" "6/8 にやる" */
export function planLabel(when: string | undefined, today: string = jstDateOffset(0)): string {
  if (!when) return '';
  const [, mm, dd] = when.split('-');
  const md = `${Number(mm)}/${Number(dd)}`;
  if (when === today) return '今日やる';
  if (when === jstDateOffset(1)) return '明日やる';
  return `${md} にやる`;
}

export const KIND_LABEL: Record<TaskKind, string> = {
  buy: '買い物',
  submit: '提出物',
  other: 'その他',
};

export const KIND_EMOJI: Record<TaskKind, string> = {
  buy: '🛒',
  submit: '📄',
  other: '📝',
};

/**
 * 表示用にタスクを並べ替える。
 * 未完了を上・完了を下。未完了内は「期限あり(早い順)→期限なし(作成順)」、
 * 完了内は完了が新しい(updatedAt が新しい)順。
 */
export function sortTasks(tasks: PrepTask[]): PrepTask[] {
  return [...tasks].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (a.done && b.done) return b.updatedAt - a.updatedAt;
    // 未完了同士
    if (a.dueDate && b.dueDate) {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      return a.createdAt - b.createdAt;
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return a.createdAt - b.createdAt;
  });
}
