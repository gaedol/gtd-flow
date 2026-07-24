import { TaskState, stateChar } from "./serialize";
import { nextOccurrenceLine } from "./repeat";

// Surgical edits to a single task line. These preserve the user's own text and
// marker order (unlike a serialize round-trip, which rebuilds from fields and
// so reorders) — the one place the checkbox/status/date/tag regexes live.

const CHECKBOX_RE = /^(\s*[-*] )\[.\]/;
const STATUS_DATE_RE = / *[✅❌] *\d{4}-\d{2}-\d{2}/u;

// set the checkbox character (" ", "/", "x", "-") without touching anything else
export function setCheckboxChar(raw: string, char: string): string {
  return raw.replace(CHECKBOX_RE, `$1[${char}]`);
}

// mark done: check the box, append ✅ today, and return the next 🔁 occurrence
// line to insert above (or null). Assumes the line is an open task.
export function completeLine(raw: string, today: string): { line: string; next: string | null } {
  return {
    line: setCheckboxChar(raw, "x") + ` ✅ ${today}`,
    next: nextOccurrenceLine(raw, today),
  };
}

// change a task's state surgically, dropping any prior ✅/❌ date, optionally
// appending a 💬 reason, and stamping the done/dropped date
export function setStateLine(raw: string, state: TaskState, today: string, reason?: string): string {
  let line = raw.replace(STATUS_DATE_RE, "").replace(CHECKBOX_RE, `$1[${stateChar(state)}]`);
  if (reason?.trim()) line = line.trimEnd() + ` 💬 ${reason.trim()}`;
  if (state === "done") line = line.trimEnd() + ` ✅ ${today}`;
  if (state === "dropped") line = line.trimEnd() + ` ❌ ${today}`;
  return line;
}

// add or remove a #tag on a task line
export function toggleTagLine(raw: string, tags: string[], tag: string): string {
  return tags.includes(tag)
    ? raw.replace(new RegExp(`\\s*#${tag}\\b`), "")
    : raw.replace(/\s*$/, "") + ` #${tag}`;
}
