import { Project, Task } from "./types";
import { isSomedayTask } from "./engine";

// Selection over an index snapshot. The inbox lives in the snapshot as a
// synthesized project; these functions decide, per surface, whether it counts —
// so callers never have to remember which raw accessor to use.

// Everything that holds tasks, including the inbox: date/urgency surfaces
// (Forecast, overdue badge, notifications) and Perspectives use this, so a
// dated or tagged inbox task is never invisible.
export function taskContainers(snapshot: Project[]): Project[] {
  return snapshot;
}

// Real project notes only (inbox excluded): the Next Actions project list,
// Timeline, move/capture target pickers, and archive-all.
export function projectNotes(snapshot: Project[], inboxPath: string): Project[] {
  return snapshot.filter((p) => p.path !== inboxPath);
}

// Inbox tasks still to process: open and not parked as someday (parking is a
// decision, so a #someday item counts as processed and lives in the Someday perspective)
export function inboxTasks(snapshot: Project[], inboxPath: string): Task[] {
  return snapshot.find((p) => p.path === inboxPath)?.tasks.filter((t) => !t.done && !isSomedayTask(t)) ?? [];
}
