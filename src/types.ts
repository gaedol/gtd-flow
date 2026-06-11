export type ProjectStatus = "active" | "on-hold" | "completed" | "dropped";
export type ProjectFlow = "sequential" | "parallel";

export interface Task {
  text: string;
  done: boolean;
  line: number;
  indent: number; // leading whitespace chars; defines action-group nesting
  defer?: string; // ISO date, Tasks-plugin 🛫
  due?: string; // ISO date, 📅
  completedOn?: string; // ISO date, ✅
  repeat?: string; // 🔁 rule, verbatim
  tags: string[];
}

export interface Project {
  path: string;
  name: string;
  status: ProjectStatus;
  flow: ProjectFlow;
  reviewInterval?: string; // e.g. "1w", "3d", "2m"
  lastReviewed?: string; // ISO date
  tasks: Task[];
}
