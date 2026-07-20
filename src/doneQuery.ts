import { Project, Task } from "./types";

export type DoneGroup = "project" | "day" | "none";

export interface DoneQuery {
  range?: string; // preset name, e.g. "last-week"
  from?: string;
  to?: string;
  project?: string; // project-name substring (case-insensitive)
  folder?: string; // path segment or prefix, e.g. "Work"
  includeDropped: boolean;
  includeArchived: boolean;
  group: DoneGroup;
  limit?: number;
}

export interface DoneEntry {
  project: Project;
  task: Task;
  date: string;
  state: "done" | "dropped";
}

const DEFAULTS: DoneQuery = {
  includeDropped: false,
  includeArchived: false,
  group: "project",
};

// "key: value" lines; blank lines and # comments ignored. Unknown keys are
// skipped so a typo degrades to a wider query rather than an error.
export function parseDoneQuery(source: string): DoneQuery {
  const q: DoneQuery = { ...DEFAULTS };
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (!value) continue;
    switch (key) {
      case "range":
        q.range = value.toLowerCase();
        break;
      case "from":
        q.from = value;
        break;
      case "to":
        q.to = value;
        break;
      case "project":
        q.project = value;
        break;
      case "folder":
        q.folder = value.replace(/^\/+|\/+$/g, "");
        break;
      case "group":
        if (value === "project" || value === "day" || value === "none") q.group = value;
        break;
      case "limit": {
        const n = parseInt(value, 10);
        if (n > 0) q.limit = n;
        break;
      }
      case "dropped":
        q.includeDropped = isTrue(value);
        break;
      case "archived":
        q.includeArchived = isTrue(value);
        break;
      case "include": {
        // include: dropped, archived
        const parts = value.toLowerCase().split(/[,\s]+/).filter(Boolean);
        if (parts.includes("dropped")) q.includeDropped = true;
        if (parts.includes("archived")) q.includeArchived = true;
        break;
      }
    }
  }
  return q;
}

function isTrue(v: string): boolean {
  const s = v.toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1";
}

const MIN_DATE = "0000-01-01";
const MAX_DATE = "9999-12-31";

function shift(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ISO weeks: Monday is day 0
function weekStart(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return shift(iso, -((d.getUTCDay() + 6) % 7));
}

function monthStart(iso: string): string {
  return iso.slice(0, 8) + "01";
}

function monthEnd(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1, 0); // day 0 of next month = last of this
  return d.toISOString().slice(0, 10);
}

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export interface DateRange {
  from: string;
  to: string;
}

// Explicit from/to always win; otherwise the preset. An open-ended range is
// clamped to the widest bound so "from: 2026-01-01" alone still works.
export function resolveRange(q: DoneQuery, today: string): DateRange {
  if (q.from || q.to) return { from: q.from ?? MIN_DATE, to: q.to ?? MAX_DATE };
  switch (q.range) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = shift(today, -1);
      return { from: y, to: y };
    }
    case "this-week":
      return { from: weekStart(today), to: shift(weekStart(today), 6) };
    case "last-week": {
      const s = shift(weekStart(today), -7);
      return { from: s, to: shift(s, 6) };
    }
    case "this-month":
      return { from: monthStart(today), to: monthEnd(today) };
    case "last-month": {
      const m = addMonths(monthStart(today), -1);
      return { from: monthStart(m), to: monthEnd(m) };
    }
    case "last-7-days":
      return { from: shift(today, -6), to: today };
    case "last-30-days":
      return { from: shift(today, -29), to: today };
    case "this-year":
      return { from: today.slice(0, 4) + "-01-01", to: today.slice(0, 4) + "-12-31" };
    case "last-year": {
      const y = String(parseInt(today.slice(0, 4), 10) - 1);
      return { from: y + "-01-01", to: y + "-12-31" };
    }
    case "all":
      return { from: MIN_DATE, to: MAX_DATE };
    default:
      // no range given: default to the last 7 days, the common review window
      return { from: shift(today, -6), to: today };
  }
}

function matchesProject(p: Project, q: DoneQuery): boolean {
  if (q.project && !p.name.toLowerCase().includes(q.project.toLowerCase())) return false;
  if (q.folder) {
    const f = q.folder.toLowerCase();
    const path = p.path.toLowerCase();
    if (!path.startsWith(f + "/") && !path.includes("/" + f + "/")) return false;
  }
  return true;
}

// Completed (and optionally dropped) tasks closed inside the range, newest first.
export function collectDone(projects: Project[], range: DateRange, q: DoneQuery): DoneEntry[] {
  const out: DoneEntry[] = [];
  for (const p of projects) {
    if (!matchesProject(p, q)) continue;
    for (const t of p.tasks) {
      if (t.completedOn && t.completedOn >= range.from && t.completedOn <= range.to && !t.dropped) {
        out.push({ project: p, task: t, date: t.completedOn, state: "done" });
      } else if (
        q.includeDropped &&
        t.cancelledOn &&
        t.cancelledOn >= range.from &&
        t.cancelledOn <= range.to
      ) {
        out.push({ project: p, task: t, date: t.cancelledOn, state: "dropped" });
      }
    }
  }
  out.sort((a, b) => b.date.localeCompare(a.date) || a.project.name.localeCompare(b.project.name));
  return q.limit ? out.slice(0, q.limit) : out;
}

export interface DoneGroupResult {
  label: string;
  entries: DoneEntry[];
}

// Grouped for display: by project (alphabetical) or by day (newest first).
export function groupDone(entries: DoneEntry[], group: DoneGroup): DoneGroupResult[] {
  if (group === "none") return [{ label: "", entries }];
  const map = new Map<string, DoneEntry[]>();
  for (const e of entries) {
    const key = group === "project" ? e.project.name : e.date;
    (map.get(key) ?? map.set(key, []).get(key)!).push(e);
  }
  const labels = [...map.keys()].sort((a, b) =>
    group === "project" ? a.localeCompare(b) : b.localeCompare(a)
  );
  return labels.map((label) => ({ label, entries: map.get(label)! }));
}

export function rangeLabel(r: DateRange): string {
  if (r.from === MIN_DATE && r.to === MAX_DATE) return "all time";
  if (r.from === r.to) return r.from;
  if (r.from === MIN_DATE) return `up to ${r.to}`;
  if (r.to === MAX_DATE) return `since ${r.from}`;
  return `${r.from} → ${r.to}`;
}

// Static markdown snapshot: plain checklist lines that read fine without the plugin.
export function renderDoneMarkdown(entries: DoneEntry[], range: DateRange, q: DoneQuery): string {
  const lines: string[] = [];
  const done = entries.filter((e) => e.state === "done").length;
  const dropped = entries.length - done;
  const counts = dropped ? `${done} done, ${dropped} dropped` : `${done} done`;
  lines.push(`**${rangeLabel(range)}** — ${counts}`);
  if (entries.length === 0) {
    lines.push("", "_Nothing closed in this period._");
    return lines.join("\n");
  }
  for (const g of groupDone(entries, q.group)) {
    lines.push("");
    if (g.label) lines.push(`### ${g.label}`);
    for (const e of g.entries) {
      const mark = e.state === "dropped" ? "❌" : "✅";
      const where = q.group === "project" ? "" : ` _(${e.project.name})_`;
      const why = e.task.reason ? ` 💬 ${e.task.reason}` : "";
      lines.push(`- [${e.state === "dropped" ? "-" : "x"}] ${e.task.text}${where} ${mark} ${e.date}${why}`);
    }
  }
  return lines.join("\n");
}
