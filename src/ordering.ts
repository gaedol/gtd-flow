import { Task } from "./types";

// default rank within a day/group: overdue first, then flagged, then the rest
export function defaultRank(task: Task, today: string, flagTag: string): number {
  if (task.due && task.due < today) return 0;
  if (task.tags.includes(flagTag)) return 1;
  return 2;
}

export function defaultSort<T extends { task: Task }>(items: T[], today: string, flagTag: string): T[] {
  // Array.sort is stable, so equal-rank items keep their incoming order
  return [...items].sort((a, b) => defaultRank(a.task, today, flagTag) - defaultRank(b.task, today, flagTag));
}

// merge a saved manual order over a default-sorted list: items the user has
// positioned follow the saved sequence; unknown (new) items weave into their
// default slot after the nearest already-positioned predecessor
export function applySavedOrder<T>(
  defaultSorted: T[],
  keyOf: (item: T) => string | undefined,
  savedOrder: string[]
): T[] {
  if (savedOrder.length === 0) return defaultSorted;
  const pos = new Map(savedOrder.map((id, i) => [id, i] as const));
  let lastKnown = -1;
  const keyed = defaultSorted.map((it, di) => {
    const key = keyOf(it);
    const si = key !== undefined ? pos.get(key) : undefined;
    if (si !== undefined) {
      lastKnown = si;
      return { it, primary: si, secondary: 0, di };
    }
    return { it, primary: lastKnown, secondary: 1, di };
  });
  keyed.sort((a, b) => a.primary - b.primary || a.secondary - b.secondary || a.di - b.di);
  return keyed.map((k) => k.it);
}

export function applyManualOrder<T extends { task: Task }>(defaultSorted: T[], savedOrder: string[]): T[] {
  return applySavedOrder(defaultSorted, (it) => it.task.blockId, savedOrder);
}
