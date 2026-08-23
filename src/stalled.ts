import { Project } from "./types";
import { availableTasks, isSomedayTask } from "./engine";

// A project is *stalled* when it's active but offers no action you could take
// right now, and *stale* when nothing in it has been closed for a while. Both
// are the things a weekly review is supposed to catch; marking them makes them
// visible without opening a view.

export type StalledKind = "empty" | "all-closed" | "all-parked" | "waiting" | "blocked";

export interface Stalled {
  kind: StalledKind;
  reason: string;
  until?: string; // for "waiting": the date it wakes up
}

export function stalledState(p: Project, today: string): Stalled | null {
  if (p.status !== "active") return null; // parked or finished on purpose
  if (availableTasks(p, today).length > 0) return null;

  if (p.tasks.length === 0) return { kind: "empty", reason: "no tasks yet" };
  const open = p.tasks.filter((t) => !t.done);
  if (open.length === 0) return { kind: "all-closed", reason: "every task closed — finish or drop the project?" };
  if (open.every(isSomedayTask)) return { kind: "all-parked", reason: "every task parked as someday" };

  // something is open but unavailable: either waiting on a date, or blocked by
  // order/subtasks in a sequential project
  const defers = open.filter((t) => !isSomedayTask(t) && t.defer && t.defer > today).map((t) => t.defer!);
  if (defers.length === open.filter((t) => !isSomedayTask(t)).length && defers.length > 0) {
    const until = defers.sort()[0];
    return { kind: "waiting", reason: `nothing starts until ${until}`, until };
  }
  return { kind: "blocked", reason: "open tasks are all blocked" };
}

// most recent ✅ or ❌ date in the project — when work last actually moved
export function lastProgressDate(p: Project): string | undefined {
  let latest: string | undefined;
  for (const t of p.tasks) {
    for (const d of [t.completedOn, t.cancelledOn]) {
      if (d && (!latest || d > latest)) latest = d;
    }
  }
  return latest;
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000
  );
}

// Days since anything was closed. Falls back to `since` (typically the note's
// creation date) for a project that has never completed anything, so a brand-new
// project isn't reported as stale on day one.
export function daysSinceProgress(p: Project, today: string, since?: string): number | undefined {
  const from = lastProgressDate(p) ?? since;
  return from ? daysBetween(from, today) : undefined;
}

// active projects only: no progress in `days` days (0 disables the check)
export function isStale(p: Project, today: string, days: number, since?: string): boolean {
  if (p.status !== "active" || days <= 0) return false;
  const n = daysSinceProgress(p, today, since);
  return n !== undefined && n >= days;
}

// one-line summary for the marker/report, or null when the project is healthy
export function attentionReason(
  p: Project,
  today: string,
  staleDays: number,
  since?: string
): string | null {
  const stalled = stalledState(p, today);
  if (stalled) return stalled.reason;
  if (isStale(p, today, staleDays, since)) {
    const n = daysSinceProgress(p, today, since)!;
    return `no progress in ${n} days`;
  }
  return null;
}
