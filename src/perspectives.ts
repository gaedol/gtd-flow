import { Project, Task } from "./types";
import { availableTasks, addInterval } from "./engine";

export interface Perspective {
  name: string;
  availableOnly: boolean;
  flagged: boolean;
  tag: string; // "" = any
  project: string; // substring match on project name, "" = any
  dueWithin: number; // days, 0 = no due filter (overdue always included when > 0)
  groupBy: "project" | "tag" | "due";
}

export const DEFAULT_PERSPECTIVES: Perspective[] = [
  { name: "Due soon", availableOnly: true, flagged: false, tag: "", project: "", dueWithin: 7, groupBy: "due" },
  { name: "Flagged", availableOnly: true, flagged: true, tag: "", project: "", dueWithin: 0, groupBy: "project" },
];

export interface PerspectiveItem {
  project: Project;
  task: Task;
}

export function runPerspective(
  projects: Project[],
  p: Perspective,
  today: string,
  flagTag: string
): Map<string, PerspectiveItem[]> {
  const items: PerspectiveItem[] = [];
  const horizon = p.dueWithin > 0 ? addInterval(today, `${p.dueWithin}d`)! : "";

  for (const project of projects) {
    if (p.project && !project.name.toLowerCase().includes(p.project.toLowerCase())) continue;
    const pool = p.availableOnly
      ? availableTasks(project, today)
      : project.status === "active" || project.status === "on-hold"
        ? project.tasks.filter((t) => !t.done)
        : [];
    for (const task of pool) {
      if (p.flagged && !task.tags.includes(flagTag)) continue;
      if (p.tag && !task.tags.includes(p.tag)) continue;
      if (p.dueWithin > 0 && (!task.due || task.due > horizon)) continue;
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
      const tags = it.task.tags.filter((t) => t !== flagTag && t !== "sequential" && t !== "parallel");
      if (tags.length === 0) add("untagged", it);
      else for (const t of tags) add("#" + t, it);
    }
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}
