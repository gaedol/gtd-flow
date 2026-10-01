import { Project, Task } from "./types";

// Selection over an index snapshot. Inbox notes live in the snapshot as
// synthesized projects (kind "inbox"); these functions decide, per surface,
// whether they count — so callers never have to remember which raw accessor to use.

export interface InboxGroup {
  note: Project;
  tasks: Task[];
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

// Open inbox tasks grouped by note, for the Next Actions inbox section. With
// skipDated, tasks that already carry a 📅 due date are left out: they surface
// in Forecast instead, so they don't need triage.
export function inboxGroups(snapshot: Project[], skipDated: boolean): InboxGroup[] {
  return snapshot
    .filter((p) => p.kind === "inbox")
    .map((note) => ({
      note,
      tasks: note.tasks.filter((t) => !t.done && !(skipDated && t.due)),
    }))
    .filter((g) => g.tasks.length > 0)
    .sort((a, b) => a.note.path.localeCompare(b.note.path));
}
