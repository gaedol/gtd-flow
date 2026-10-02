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

// the current status character of a task line, or null if it isn't a task
export function checkboxCharOf(raw: string): string | null {
  return raw.match(/^\s*[-*] \[(.)\]/)?.[1] ?? null;
}

// mark done: check the box, append ✅ today, and return the next 🔁 occurrence
// line to insert above (or null). Assumes the line is an open task.
export function completeLine(raw: string, today: string, fallbackDue?: string): { line: string; next: string | null } {
  return {
    line: setCheckboxChar(raw, "x") + ` ✅ ${today}`,
    next: nextOccurrenceLine(raw, today, fallbackDue),
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

// give a task line a trailing ^block-id unless it already has one
export function withBlockId(raw: string, id: string): string {
  return /\s\^[A-Za-z0-9-]+\s*$/.test(raw) ? raw : raw.trimEnd() + ` ^${id}`;
}

// what a triaged task leaves behind in its source note: a plain bullet (no
// checkbox, so it isn't a task any more) with the task text and a link to
// where it went
export function triagedLine(raw: string, text: string, link: string): string {
  const indent = raw.match(/^\s*/)?.[0] ?? "";
  return `${indent}- ${text} → ${link}`;
}
