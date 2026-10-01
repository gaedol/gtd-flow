import { Project, Task } from "./types";
import { parseTaskLine } from "./parser";
import { availableTasks, isSomedayTask } from "./engine";

// Re-parses doc lines so decorations track unsaved edits, not the (possibly stale)
// index. `path` is the note being shown; when the project spans several notes,
// its live lines replace that note's indexed tasks, so sequential blocking from
// the hub or earlier members still applies.
export function buildLineClasses(
  project: Project,
  lines: string[],
  today: string,
  path: string = project.path
): Map<number, string> {
  const tasks: Task[] = [];
  lines.forEach((l, i) => {
    const t = parseTaskLine(l, i);
    if (t) tasks.push({ ...t, path });
  });
  const order = [project.path, ...(project.members ?? [])];
  const all = order.flatMap((p) => (p === path ? tasks : project.tasks.filter((t) => (t.path ?? project.path) === p)));
  const live: Project = { ...project, tasks: all };
  const availList = availableTasks(live, today);
  const avail = new Set(availList);
  const next = availList[0];

  const map = new Map<number, string>();
  tasks.forEach((t, i) => {
    if (t.done) {
      if (t.dropped) map.set(t.line, "gtd-ln-dropped");
      return;
    }
    if (isSomedayTask(t)) {
      map.set(t.line, "gtd-ln-someday");
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
  for (let j = i + 1; j < tasks.length && tasks[j].indent > tasks[i].indent && tasks[j].path === tasks[i].path; j++) {
    if (avail.has(tasks[j])) return true;
  }
  return false;
}
