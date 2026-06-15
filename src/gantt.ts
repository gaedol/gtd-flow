import { Project, Task } from "./types";
import { availableTasks, addInterval } from "./engine";

export type TimelineMode = "day" | "week" | "month";

export interface GanttOptions {
  dayStart: string; // "09:00"
  dayEnd: string; // "22:00"
  defaultDurationMin: number;
  flagTag: string;
}

// invisible milestones (hidden via CSS) pin the axis to the full window
function bounds(from: string, to: string): string[] {
  return ["  section .", `    . :milestone, gtdb0, ${from}, 0d`, `    . :milestone, gtdb1, ${to}, 0d`];
}

// small left margin so project header rows sit hard against the left edge
const INIT = '%%{init: {"gantt": {"leftPadding": 8}}}%%';

// strip wikilink markup and characters mermaid treats as gantt syntax
function clean(text: string): string {
  const s = text
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1") // [[target|alias]] -> alias
    .replace(/\[\[([^\]]+)\]\]/g, "$1") // [[target]] -> target
    .replace(/[:;#,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s || "(untitled)";
}

// short label for a bar; full text still lives in the note
function label(text: string, max = 40): string {
  const s = clean(text);
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function tags(task: Task, available: Set<Task>, today: string): string {
  if (task.due && task.due < today) return "crit, ";
  if (available.has(task)) return "active, ";
  return "";
}

export function ganttSource(
  projects: Project[],
  mode: TimelineMode,
  today: string,
  opts: GanttOptions
): string {
  return mode === "day" ? dayChart(projects, today, opts) : rangeChart(projects, mode, today);
}

function rangeChart(projects: Project[], mode: "week" | "month", today: string): string {
  const end = addInterval(today, mode === "week" ? "6d" : "1m")!;
  const lines = [
    INIT,
    "gantt",
    `  title ${mode === "week" ? "Week" : "Month"} from ${today}`,
    "  dateFormat YYYY-MM-DD",
    `  axisFormat ${mode === "week" ? "%a" : "%d %b"}`,
    `  tickInterval ${mode === "week" ? "1day" : "1week"}`,
    "  todayMarker stroke-width:2px",
  ];
  let any = false;
  for (const p of projects) {
    if (p.status !== "active") continue;
    const avail = new Set(availableTasks(p, today));
    const rows: string[] = [];
    for (const t of p.tasks) {
      if (t.done) continue;
      const start = t.defer ?? t.due;
      const due = t.due ?? t.defer;
      if (!start || !due) continue;
      // clamp overdue starts to the visible range
      const s = start < today ? today : start;
      if (s > end || due < today) {
        if (!(t.due && t.due < today)) continue; // overdue tasks stay visible on today
      }
      const from = t.due && t.due < today ? today : s;
      // clip to the window so one long task can't stretch the whole axis
      let to = due < from ? from : due;
      if (to > end) to = end;
      rows.push(
        to === from
          ? `    ${label(t.text)} :${tags(t, avail, today)}${from}, 1d`
          : `    ${label(t.text)} :${tags(t, avail, today)}${from}, ${to}`
      );
    }
    if (rows.length > 0) {
      // header row: a 0-day (zero-width) task puts the project name on its own
      // line; Mermaid's overlapping section title is hidden via CSS
      lines.push(`  section ${clean(p.name)}`, `    ${clean(p.name)} :gtdhdr, ${today}, 0d`, ...rows);
      any = true;
    }
  }
  if (!any) return "";
  lines.push(...bounds(today, end));
  return lines.join("\n");
}

// urgency rank for the day: overdue, then due today, then starting today
function dayRank(t: Task, today: string): number {
  if (t.due && t.due < today) return 0;
  if (t.due === today) return 1;
  return 2; // defer === today
}

// only what actually belongs to today: due today, overdue, or deferred-until-today
function isToday(t: Task, today: string): boolean {
  if (t.done) return false;
  if (t.due && t.due <= today) return true;
  return t.defer === today;
}

function dayChart(projects: Project[], today: string, opts: GanttOptions): string {
  interface Item { task: Task; project: Project; avail: Set<Task> }
  const items: Item[] = [];
  for (const p of projects) {
    if (p.status !== "active") continue;
    const avail = new Set(availableTasks(p, today));
    for (const t of p.tasks) {
      if (isToday(t, today)) items.push({ task: t, project: p, avail });
    }
  }
  if (items.length === 0) return "";
  items.sort((a, b) => {
    const r = dayRank(a.task, today) - dayRank(b.task, today);
    if (r !== 0) return r;
    return (a.task.due ?? "9999").localeCompare(b.task.due ?? "9999");
  });

  const lines = [
    INIT,
    "gantt",
    `  title Today — ${today}`,
    "  dateFormat YYYY-MM-DDTHH:mm",
    "  axisFormat %H",
    "  tickInterval 3hour",
    "  section Today",
  ];
  const multi = new Set(items.map((i) => i.project.path)).size > 1;
  // tasks with ⏰ are pinned at their clock time; untimed tasks fill the gaps
  interface Placed { row: string; startMin: number; dur: number }
  const placed: Placed[] = [];
  const occupied: [number, number][] = [];
  const meta = items.map(({ task: t, project: p, avail }) => ({
    label: (multi ? `${label(t.text, 28)} (${clean(p.name)})` : label(t.text)) + ` :${tags(t, avail, today)}`,
    dur: t.durationMin ?? opts.defaultDurationMin,
    startMin: t.startTime ? toMin(t.startTime) : undefined,
  }));

  for (const m of meta) {
    if (m.startMin === undefined) continue;
    placed.push({ row: `    ${m.label}${stamp(today, m.startMin)}, ${m.dur}m`, startMin: m.startMin, dur: m.dur });
    occupied.push([m.startMin, m.startMin + m.dur]);
  }
  occupied.sort((a, b) => a[0] - b[0]);

  let clock = toMin(opts.dayStart);
  for (const m of meta) {
    if (m.startMin !== undefined) continue;
    for (let moved = true; moved; ) {
      moved = false;
      for (const [os, oe] of occupied) {
        if (clock < oe && clock + m.dur > os) {
          clock = oe;
          moved = true;
        }
      }
    }
    placed.push({ row: `    ${m.label}${stamp(today, clock)}, ${m.dur}m`, startMin: clock, dur: m.dur });
    occupied.push([clock, clock + m.dur]);
    occupied.sort((a, b) => a[0] - b[0]);
    clock += m.dur;
  }

  placed.sort((a, b) => a.startMin - b.startMin);
  for (const p of placed) lines.push(p.row);
  lines.push(...bounds(`${today}T${opts.dayStart}`, `${today}T${opts.dayEnd}`));
  return lines.join("\n");
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function stamp(today: string, min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${today}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// compact gantt of one project's open dated tasks, for the in-note status block
export function projectGanttSource(p: Project, today: string): string {
  const avail = new Set(availableTasks(p, today));
  const rows: string[] = [];
  for (const t of p.tasks) {
    if (t.done) continue;
    const start = t.defer ?? t.due;
    const due = t.due ?? t.defer;
    if (!start || !due) continue;
    const from = start < today ? today : start;
    const to = due < from ? from : due;
    rows.push(
      to === from
        ? `    ${label(t.text)} :${tags(t, avail, today)}${from}, 1d`
        : `    ${label(t.text)} :${tags(t, avail, today)}${from}, ${to}`
    );
  }
  if (rows.length === 0) return "";
  return ["gantt", "  dateFormat YYYY-MM-DD", "  axisFormat %d %b", `  section ${clean(p.name)}`, ...rows].join("\n");
}

