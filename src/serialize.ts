export interface TaskFields {
  indent: number;
  done: boolean;
  completedOn?: string;
  text: string;
  tags: string[];
  repeat?: string;
  defer?: string;
  due?: string;
  durationMin?: number;
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
  let s = " ".repeat(f.indent) + `- [${f.done ? "x" : " "}] ${f.text}`;
  for (const t of f.tags) s += ` #${t}`;
  if (f.repeat) s += ` 🔁 ${f.repeat}`;
  if (f.defer) s += ` 🛫 ${f.defer}`;
  if (f.due) s += ` 📅 ${f.due}`;
  if (f.durationMin) s += ` ⏱ ${formatDuration(f.durationMin)}`;
  if (f.done && f.completedOn) s += ` ✅ ${f.completedOn}`;
  return s;
}
