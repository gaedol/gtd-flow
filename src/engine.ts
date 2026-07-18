import { Project, ProjectFlow, Task } from "./types";
import { nextDueFromRule } from "./repeat";

export interface TaskNode {
  task: Task;
  children: TaskNode[];
}

export function buildTree(tasks: Task[]): TaskNode[] {
  const roots: TaskNode[] = [];
  const stack: TaskNode[] = [];
  for (const t of tasks) {
    const node: TaskNode = { task: t, children: [] };
    while (stack.length && stack[stack.length - 1].task.indent >= t.indent) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return roots;
}

function groupFlow(parent: Task, inherited: ProjectFlow): ProjectFlow {
  if (parent.tags.includes("sequential")) return "sequential";
  if (parent.tags.includes("parallel")) return "parallel";
  return inherited;
}

// the tag that parks a single task as someday (configurable; default "someday")
let somedayTag = "someday";
export function setSomedayTag(t: string): void {
  somedayTag = t || "someday";
}
export function isSomedayTask(t: Task): boolean {
  return t.tags.includes(somedayTag);
}

function collect(nodes: TaskNode[], flow: ProjectFlow, today: string, out: Task[]): void {
  let blocked = false;
  for (const n of nodes) {
    const deferred = !!n.task.defer && n.task.defer > today;
    const someday = isSomedayTask(n.task);
    if (!n.task.done && !someday && !blocked && !deferred) {
      const openChildren = n.children.some((c) => !c.task.done);
      // a group with open children is a container, not an action
      if (!openChildren) out.push(n.task);
      else collect(n.children, groupFlow(n.task, flow), today, out);
    }
    // someday tasks are skipped without blocking the rest of a sequence
    if (flow === "sequential" && !n.task.done && !someday) blocked = true;
  }
}

export function availableTasks(project: Project, today: string): Task[] {
  if (project.status !== "active") return [];
  const out: Task[] = [];
  collect(buildTree(project.tasks), project.flow, today, out);
  return out;
}

export function isAvailable(task: Task, project: Project, today: string): boolean {
  return availableTasks(project, today).includes(task);
}

// a parent with any open descendant is a container, not an action itself
export function hasOpenSubtasks(tasks: Task[], i: number): boolean {
  const indent = tasks[i].indent;
  for (let j = i + 1; j < tasks.length && tasks[j].indent > indent; j++) {
    if (!tasks[j].done) return true;
  }
  return false;
}

// leaf action eligible for counts/badges: open, not parked, not a container
export function datedActionable(tasks: Task[], i: number): boolean {
  const t = tasks[i];
  return !t.done && !isSomedayTask(t) && !hasOpenSubtasks(tasks, i);
}

// shown in date views even when blocked (a blocked action still has a deadline);
// only done and parked-someday tasks are hidden
export function datedVisible(t: Task): boolean {
  return !t.done && !isSomedayTask(t);
}

export function overdueCount(projects: Project[], today: string): number {
  let n = 0;
  for (const p of projects) {
    if (p.status !== "active") continue;
    p.tasks.forEach((t, i) => {
      if (datedActionable(p.tasks, i) && t.due && t.due < today) n++;
    });
  }
  return n;
}

export interface DatedTask {
  project: Project;
  task: Task;
}

// open tasks in active projects that are due today or overdue
export function dueOrOverdue(projects: Project[], today: string): DatedTask[] {
  const out: DatedTask[] = [];
  for (const p of projects) {
    if (p.status !== "active") continue;
    p.tasks.forEach((t, i) => {
      if (datedActionable(p.tasks, i) && t.due && t.due <= today) out.push({ project: p, task: t });
    });
  }
  return out;
}

// First available task per project — the project's next action
export function nextAction(project: Project, today: string): Task | undefined {
  return availableTasks(project, today)[0];
}

const INTERVAL_RE = /^(\d+)\s*([dwmy])$/;

export function addInterval(date: string, interval: string): string | undefined {
  const m = interval.trim().match(INTERVAL_RE);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  const d = new Date(date + "T00:00:00Z");
  if (isNaN(d.getTime())) return undefined;
  if (m[2] === "d") d.setUTCDate(d.getUTCDate() + n);
  if (m[2] === "w") d.setUTCDate(d.getUTCDate() + n * 7);
  if (m[2] === "m") d.setUTCMonth(d.getUTCMonth() + n);
  if (m[2] === "y") d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
}

export function isDueForReview(project: Project, today: string): boolean {
  if (project.status !== "active" || !project.reviewInterval) return false;
  if (!project.lastReviewed) return true;
  const next = addInterval(project.lastReviewed, project.reviewInterval);
  return next !== undefined && next <= today;
}

export interface ForecastItem {
  project: Project;
  task: Task;
  date: string;
  kind: "due" | "becomes-available";
  available: boolean; // false when the task is blocked (waiting on order/subtasks)
  preview?: boolean; // a non-actionable 🔁 next-occurrence hint, not a real task
}

export function forecast(projects: Project[], today: string, days: number): ForecastItem[] {
  const end = addInterval(today, `${days}d`)!;
  const items: ForecastItem[] = [];
  for (const p of projects) {
    if (p.status !== "active") continue;
    const avail = new Set(availableTasks(p, today));
    for (const t of p.tasks) {
      if (!datedVisible(t)) continue; // hide only done/someday; blocked tasks still show
      if (t.due) {
        // overdue items surface on today; defer is ignored once a due date exists (due wins over defer)
        if (t.due <= end) {
          items.push({ project: p, task: t, date: t.due < today ? today : t.due, kind: "due", available: avail.has(t) });
          // preview the next fixed-schedule occurrence if it also lands in the window
          if (t.repeat) {
            const nd = nextDueFromRule(t.repeat, t.due);
            if (nd && nd > t.due && nd <= end) {
              items.push({ project: p, task: t, date: nd, kind: "due", available: false, preview: true });
            }
          }
        }
      } else if (t.defer && t.defer >= today && t.defer <= end) {
        // defer == today surfaces in the Today column; past defers are just available (Next Actions)
        items.push({ project: p, task: t, date: t.defer, kind: "becomes-available", available: false });
      }
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
