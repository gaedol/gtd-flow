import { Project, Task } from "./types";
import { availableTasks, addInterval, isSomedayTask } from "./engine";

export type SomedayMode = "exclude" | "include" | "only";

export interface Perspective {
  name: string;
  availableOnly: boolean;
  flagged: boolean;
  important?: boolean; // when true, only #important-tagged tasks
  tag: string; // context tag/hierarchy element, "" = any (e.g. "home" matches "home/plumbing")
  project: string; // substring match on project name, "" = any
  dueWithin: number; // days, 0 = no date filter; with `done` it means "closed within"
  groupBy: "project" | "tag" | "due";
  somedayMode?: SomedayMode; // default "exclude"
  someday?: boolean; // legacy: read as somedayMode "only" when the above is unset
  done?: boolean; // when true, list completed/dropped tasks instead of open ones
}

export function somedayModeOf(p: Perspective): SomedayMode {
  return p.somedayMode ?? (p.someday ? "only" : "exclude");
}

export const DEFAULT_PERSPECTIVES: Perspective[] = [
  { name: "Due soon", availableOnly: true, flagged: false, tag: "", project: "", dueWithin: 7, groupBy: "due" },
  { name: "Flagged", availableOnly: true, flagged: true, tag: "", project: "", dueWithin: 0, groupBy: "project" },
  { name: "Important", availableOnly: true, flagged: false, important: true, tag: "", project: "", dueWithin: 0, groupBy: "project" },
  { name: "Someday", availableOnly: false, flagged: false, tag: "", project: "", dueWithin: 0, groupBy: "project", someday: true },
  { name: "Done", availableOnly: false, flagged: false, tag: "", project: "", dueWithin: 0, groupBy: "project", done: true },
];

export interface PerspectiveItem {
  project: Project;
  task: Task;
}

// hierarchy-aware: filter "home" matches "home" and any "home/..." context
export function tagMatches(tags: string[], filter: string): boolean {
  return tags.some((t) => t === filter || t.startsWith(filter + "/"));
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function runPerspective(
  projects: Project[],
  p: Perspective,
  today: string,
  flagTag: string,
  importantTag = "important"
): Map<string, PerspectiveItem[]> {
  const items: PerspectiveItem[] = [];
  const horizon = p.dueWithin > 0 ? addInterval(today, `${p.dueWithin}d`)! : "";

  const mode = somedayModeOf(p);
  const closedSince = p.done && p.dueWithin > 0 ? shiftDays(today, -p.dueWithin) : "";

  for (const project of projects) {
    if (p.project && !project.name.toLowerCase().includes(p.project.toLowerCase())) continue;
    const open = project.tasks.filter((t) => !t.done);
    let pool: Task[];
    if (p.done) {
      pool = project.tasks.filter((t) => t.done); // closed work counts wherever it ended up
    } else {
      // actionable work lives in active projects; on-hold is parked, like someday
      const active = project.status === "active";
      let actionable = active ? open.filter((t) => !isSomedayTask(t)) : [];
      if (p.availableOnly) {
        const avail = new Set(availableTasks(project, today));
        actionable = actionable.filter((t) => avail.has(t));
      }
      // parked work only when asked for; availability doesn't apply to it
      const parked =
        mode === "exclude"
          ? []
          : project.status === "someday"
            ? open
            : active
              ? open.filter(isSomedayTask)
              : [];
      pool = mode === "only" ? parked : [...actionable, ...parked];
    }
    for (const task of pool) {
      if (p.flagged && !task.tags.includes(flagTag)) continue;
      if (p.important && !task.tags.includes(importantTag)) continue;
      if (p.tag && !tagMatches(task.tags, p.tag)) continue;
      if (p.dueWithin > 0) {
        if (p.done) {
          // for closed tasks the window means "closed within N days"
          const closed = task.completedOn ?? task.cancelledOn;
          if (!closed || closed < closedSince) continue;
        } else if (!task.due || task.due > horizon) continue;
      }
      items.push({ project, task });
    }
  }

  const groups = new Map<string, PerspectiveItem[]>();
  const add = (key: string, it: PerspectiveItem) => {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  };
  for (const it of items) {
    if (p.groupBy === "project") add(it.project.name, it);
    else if (p.groupBy === "due") add(it.task.due ?? "no due date", it);
    else {
      const tags = it.task.tags.filter((t) => t !== flagTag && t !== importantTag && t !== "sequential" && t !== "parallel");
      // roll up to the top-level context, so #home/plumbing and #home/garden
      // share one #home group and a task lands in it once
      const roots = new Set(tags.map((t) => t.split("/")[0]));
      if (roots.size === 0) add("untagged", it);
      else for (const r of roots) add("#" + r, it);
    }
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}
