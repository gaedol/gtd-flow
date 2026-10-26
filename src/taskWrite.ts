import { TaskState, stateChar } from "./serialize";
import { nextOccurrenceLine } from "./repeat";

// Surgical edits to a single task line. These preserve the user's own text and
// marker order (unlike a serialize round-trip, which rebuilds from fields and
// so reorders) — the one place the checkbox/status/date/tag regexes live.

const CHECKBOX_RE = /^(\s*[-*] )\[.\]/;
// global: a line can carry more than one, e.g. after an earlier double write
const STATUS_DATE_RE = / *[✅❌] *\d{4}-\d{2}-\d{2}/gu;
const TASK_ID_RE = / *🆔 *[\w-]+/u;
// a ^block-id only parses as one at the very end of the line
const TRAILING_BLOCK_ID_RE = /\s+\^[A-Za-z0-9-]+\s*$/;

// set the checkbox character (" ", "/", "x", "-") without touching anything else
export function setCheckboxChar(raw: string, char: string): string {
  return raw.replace(CHECKBOX_RE, `$1[${char}]`);
}

// the current status character of a task line, or null if it isn't a task
export function checkboxCharOf(raw: string): string | null {
  return raw.match(/^\s*[-*] \[(.)\]/)?.[1] ?? null;
}

// edit the body of a line while keeping any trailing ^block-id last
function beforeBlockId(raw: string, edit: (body: string) => string): string {
  const m = raw.match(TRAILING_BLOCK_ID_RE);
  if (!m) return edit(raw);
  return edit(raw.slice(0, m.index)) + m[0].trimEnd();
}

// mark done: check the box, stamp ✅ today (replacing any stale ✅/❌), and
// return the next 🔁 occurrence to insert above, or null. The occurrence is a
// new task, so it gets neither the block id nor the 🆔 — duplicates would
// collide, and dependents would wait on every future occurrence.
export function completeLine(raw: string, today: string): { line: string; next: string | null } {
  const line = beforeBlockId(raw, (body) =>
    setCheckboxChar(body.replace(STATUS_DATE_RE, ""), "x").trimEnd() + ` ✅ ${today}`
  );
  const source = raw.replace(TRAILING_BLOCK_ID_RE, "").replace(STATUS_DATE_RE, "").replace(TASK_ID_RE, "");
  return { line, next: nextOccurrenceLine(source, today) };
}

// change a task's state surgically, dropping any prior ✅/❌ date, optionally
// appending a 💬 reason, and stamping the done/dropped date
export function setStateLine(raw: string, state: TaskState, today: string, reason?: string): string {
  return beforeBlockId(raw, (body) => {
    let line = body.replace(STATUS_DATE_RE, "").replace(CHECKBOX_RE, `$1[${stateChar(state)}]`);
    if (reason?.trim()) line = line.trimEnd() + ` 💬 ${reason.trim()}`;
    if (state === "done") line = line.trimEnd() + ` ✅ ${today}`;
    if (state === "dropped") line = line.trimEnd() + ` ❌ ${today}`;
    return line;
  });
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// `#tag` itself, or with `/sub` levels when `nested`, never a longer tag like #tagged
function tagRe(tag: string, nested: boolean): RegExp {
  return new RegExp(`\\s*#${escapeRe(tag)}${nested ? "(?:/[\\p{L}\\p{N}_/-]*)?" : ""}(?![\\p{L}\\p{N}_/-])`, "gu");
}

// add or remove a #tag on a task line
export function toggleTagLine(raw: string, tags: string[], tag: string): string {
  if (tags.includes(tag)) return raw.replace(tagRe(tag, false), "");
  return beforeBlockId(raw, (body) => body.replace(/\s*$/, "") + ` #${tag}`);
}

const DEFER_DATE_RE = / *🛫 *\d{4}-\d{2}-\d{2}/gu;
const CREATED_DATE_RE = /➕ *\d{4}-\d{2}-\d{2}/u;

// a person's name as a tag level: "Anna Rossi" → "Anna-Rossi"
export function waitTagFor(waitTag: string, who: string): string {
  const name = who.trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "");
  return name ? `${waitTag}/${name}` : waitTag;
}

// mark a task as waiting on `who`: replaces any earlier wait tag and 🛫 with the
// follow-up date, and stamps ➕ today unless the task already has one
export function setWaitingLine(raw: string, waitTag: string, who: string, followUp: string | undefined, today: string): string {
  return beforeBlockId(raw, (body) => {
    let line = body.replace(tagRe(waitTag, true), "").replace(DEFER_DATE_RE, "").trimEnd();
    line += ` #${waitTagFor(waitTag, who)}`;
    if (followUp) line += ` 🛫 ${followUp}`;
    if (!CREATED_DATE_RE.test(line)) line += ` ➕ ${today}`;
    return line;
  });
}

// no longer waiting: drops the wait tag and its follow-up 🛫, keeps ➕
export function clearWaitingLine(raw: string, waitTag: string): string {
  return beforeBlockId(raw, (body) => body.replace(tagRe(waitTag, true), "").replace(DEFER_DATE_RE, "").trimEnd());
}
