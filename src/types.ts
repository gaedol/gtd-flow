export type ProjectStatus = "active" | "on-hold" | "someday" | "completed" | "dropped";
export type ProjectFlow = "sequential" | "parallel";

export interface Task {
  path?: string; // note the line lives in (set by the index); a project can span notes
  text: string;
  done: boolean;
  line: number;
  indent: number; // leading whitespace chars; defines action-group nesting
  defer?: string; // ISO date, Tasks-plugin 🛫
  due?: string; // ISO date, 📅
  dueFromFile?: boolean; // due wasn't written on the line: it comes from a date in the note's name
  completedOn?: string; // ISO date, ✅
  repeat?: string; // 🔁 rule, verbatim
  durationMin?: number; // ⏱ estimated duration in minutes
  startTime?: string; // ⏰ time of day "HH:MM"
  dropped?: boolean; // "[-]" cancelled — resolved (done=true) but not completed
  inProgress?: boolean; // "[/]" started — still available
  cancelledOn?: string; // ❌ cancellation date
  reason?: string; // 💬 why it was closed/dropped
  blockId?: string; // trailing ^id — stable identity for manual ordering
  tags: string[];
}

export interface Project {
  path: string;
  name: string;
  kind?: "project" | "inbox"; // absent = project; "inbox" = untriaged tasks in a non-project note
  status: ProjectStatus;
  flow: ProjectFlow;
  reviewInterval?: string; // e.g. "1w", "3d", "2m"
  lastReviewed?: string; // ISO date
  color?: string; // page tint, hex
  banner?: string; // background image: vault path or URL
  members?: string[]; // member note paths (their `project:` links here), in task order
  tasks: Task[];
}
