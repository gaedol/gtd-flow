export type TaskState = "todo" | "in-progress" | "done" | "dropped";

export interface TaskFields {
  indent: number;
  done: boolean;
  dropped?: boolean;
  inProgress?: boolean;
  completedOn?: string;
  cancelledOn?: string;
  text: string;
  tags: string[];
  repeat?: string;
  defer?: string;
  due?: string;
  durationMin?: number;
  startTime?: string;
}

export function stateOf(f: { done: boolean; dropped?: boolean; inProgress?: boolean }): TaskState {
  if (f.dropped) return "dropped";
  if (f.done) return "done";
  if (f.inProgress) return "in-progress";
  return "todo";
}

const STATE_CHAR: Record<TaskState, string> = {
  todo: " ",
  "in-progress": "/",
  done: "x",
  dropped: "-",
};

export function stateChar(state: TaskState): string {
  return STATE_CHAR[state];
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${m}m`;
  return h ? `${h}h` : `${m}m`;
}

export function parseDuration(s: string): number | undefined {
  const m = s.trim().match(/^(?:(\d+)h)? *(?:(\d+)m)?$/);
  if (!m || (!m[1] && !m[2])) return undefined;
  return parseInt(m[1] ?? "0", 10) * 60 + parseInt(m[2] ?? "0", 10);
}

export function serializeTask(f: TaskFields): string {
  const state = stateOf(f);
  let s = " ".repeat(f.indent) + `- [${STATE_CHAR[state]}] ${f.text}`;
  for (const t of f.tags) s += ` #${t}`;
  if (f.repeat) s += ` 🔁 ${f.repeat}`;
  if (f.defer) s += ` 🛫 ${f.defer}`;
  if (f.due) s += ` 📅 ${f.due}`;
  if (f.startTime) s += ` ⏰ ${f.startTime}`;
  if (f.durationMin) s += ` ⏱ ${formatDuration(f.durationMin)}`;
  if (state === "done" && f.completedOn) s += ` ✅ ${f.completedOn}`;
  if (state === "dropped" && f.cancelledOn) s += ` ❌ ${f.cancelledOn}`;
  return s;
}
