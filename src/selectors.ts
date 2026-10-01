import { Project, Task } from "./types";
import { isSomedayTask } from "./engine";

// Selection over an index snapshot. Inbox notes live in the snapshot as
// synthesized projects (kind "inbox"); these functions decide, per surface,
// whether they count — so callers never have to remember which raw accessor to use.

export interface InboxGroup {
  note: Project;
  tasks: Task[];
}

// The note a task's line lives in. A project can span several notes, so writes
// and navigation go through this rather than the project's (hub) path.
export function noteOf(project: Project, task: Task): string {
  return task.path ?? project.path;
}

// Everything that holds tasks, including inbox notes: date/urgency surfaces
// (Forecast, overdue badge, notifications) and Perspectives use this, so a
// dated or tagged inbox task is never invisible.
export function taskContainers(snapshot: Project[]): Project[] {
  return snapshot;
}

// Real project notes only (inbox notes excluded): the Next Actions project list,
// Timeline, move/capture target pickers, and archive-all.
export function projectNotes(snapshot: Project[]): Project[] {
  return snapshot.filter((p) => p.kind !== "inbox");
}

// tasks parked as someday: tagged themselves or nested under a tagged parent
// (as in the engine, a someday group parks its whole subtree)
function somedayParked(tasks: Task[]): Set<Task> {
  const parked = new Set<Task>();
  const stack: Task[] = [];
  for (const t of tasks) {
    while (stack.length && stack[stack.length - 1].indent >= t.indent) stack.pop();
    if (isSomedayTask(t) || stack.some((s) => parked.has(s))) parked.add(t);
    stack.push(t);
  }
  return parked;
}

// Open inbox tasks grouped by note, for the Next Actions inbox section. With
// skipDated, tasks that already carry a 📅 due date are left out: they surface
// in Forecast instead, so they don't need triage. With skipSomeday, tasks
// parked as someday are left out too.
export function inboxGroups(snapshot: Project[], skipDated: boolean, skipSomeday = false): InboxGroup[] {
  return snapshot
    .filter((p) => p.kind === "inbox")
    .map((note) => {
      const parked = skipSomeday ? somedayParked(note.tasks) : new Set<Task>();
      return { note, tasks: note.tasks.filter((t) => !t.done && !(skipDated && t.due) && !parked.has(t)) };
    })
    .filter((g) => g.tasks.length > 0)
    .sort((a, b) => a.note.path.localeCompare(b.note.path));
}
