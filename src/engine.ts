import { Project, ProjectFlow, Task } from "./types";

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

function collect(nodes: TaskNode[], flow: ProjectFlow, today: string, out: Task[]): void {
  let blocked = false;
  for (const n of nodes) {
    const deferred = !!n.task.defer && n.task.defer > today;
    if (!n.task.done && !blocked && !deferred) {
      const openChildren = n.children.some((c) => !c.task.done);
      // a group with open children is a container, not an action
      if (!openChildren) out.push(n.task);
      else collect(n.children, groupFlow(n.task, flow), today, out);
    }
    if (flow === "sequential" && !n.task.done) blocked = true;
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

export function overdueCount(projects: Project[], today: string): number {
  let n = 0;
  for (const p of projects) {
    if (p.status !== "active") continue;
    for (const t of p.tasks) if (!t.done && t.due && t.due < today) n++;
  }
  return n;
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
}

export function forecast(projects: Project[], today: string, days: number): ForecastItem[] {
  const end = addInterval(today, `${days}d`)!;
  const items: ForecastItem[] = [];
  for (const p of projects) {
    if (p.status !== "active") continue;
    for (const t of p.tasks) {
      if (t.done) continue;
      if (t.due) {
        // overdue items surface on today; defer is ignored once a due date exists (due wins over defer)
        if (t.due <= end) {
          items.push({ project: p, task: t, date: t.due < today ? today : t.due, kind: "due" });
        }
      } else if (t.defer && t.defer >= today && t.defer <= end) {
        // defer == today surfaces in the Today column; past defers are just available (Next Actions)
        items.push({ project: p, task: t, date: t.defer, kind: "becomes-available" });
      }
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
