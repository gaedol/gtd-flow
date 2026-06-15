import { Project, Task } from "./types";
import { parseTaskLine } from "./parser";
import { availableTasks } from "./engine";

// Re-parses doc lines so decorations track unsaved edits, not the (possibly stale) index
export function buildLineClasses(
  project: Project,
  lines: string[],
  today: string
): Map<number, string> {
  const tasks: Task[] = [];
  lines.forEach((l, i) => {
    const t = parseTaskLine(l, i);
    if (t) tasks.push(t);
  });
  const live: Project = { ...project, tasks };
  const avail = new Set(availableTasks(live, today));
  const next = availableTasks(live, today)[0];

  const map = new Map<number, string>();
  tasks.forEach((t, i) => {
    if (t.done) {
      if (t.dropped) map.set(t.line, "gtd-ln-dropped");
      return;
    }
    const cls: string[] = [];
    if (t === next) cls.push("gtd-ln-next");
    else if (avail.has(t)) cls.push("gtd-ln-available");
    else if (t.defer && t.defer > today) cls.push("gtd-ln-deferred");
    else if (subtreeHasAvailable(tasks, i, avail)) cls.push("gtd-ln-group");
    else cls.push("gtd-ln-blocked");
    if (t.inProgress) cls.push("gtd-ln-inprogress");
    if (t.due && t.due < today) cls.push("gtd-ln-overdue");
    map.set(t.line, cls.join(" "));
  });
  return map;
}

// an active group: not actionable itself but contains an available action
function subtreeHasAvailable(tasks: Task[], i: number, avail: Set<Task>): boolean {
  for (let j = i + 1; j < tasks.length && tasks[j].indent > tasks[i].indent; j++) {
    if (avail.has(tasks[j])) return true;
  }
  return false;
}
