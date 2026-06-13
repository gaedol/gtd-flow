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

// mermaid gantt treats : ; # , as syntax
function clean(text: string): string {
  const s = text.replace(/[:;#,]/g, " ").replace(/\s+/g, " ").trim();
  return s || "(untitled)";
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
          ? `    ${clean(t.text)} :${tags(t, avail, today)}${from}, 1d`
          : `    ${clean(t.text)} :${tags(t, avail, today)}${from}, ${to}`
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

// urgency rank for the plan-of-day: overdue, then flagged, then due today, then the rest
function dayRank(t: Task, today: string, flagTag: string): number {
  if (t.due && t.due < today) return 0;
  if (t.tags.includes(flagTag)) return 1;
  if (t.due === today) return 2;
  return 3;
}

function dayChart(projects: Project[], today: string, opts: GanttOptions): string {
  interface Item { task: Task; project: Project; avail: Set<Task> }
  const items: Item[] = [];
  for (const p of projects) {
    if (p.status !== "active") continue;
    const avail = new Set(availableTasks(p, today));
    for (const t of p.tasks) {
      if (!t.done && (avail.has(t) || (t.due && t.due <= today))) items.push({ task: t, project: p, avail });
    }
  }
  if (items.length === 0) return "";
  items.sort((a, b) => {
    const r = dayRank(a.task, today, opts.flagTag) - dayRank(b.task, today, opts.flagTag);
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
  let clock = `${today}T${opts.dayStart}`;
  for (const { task: t, project: p, avail } of items) {
    const dur = t.durationMin ?? opts.defaultDurationMin;
    const label = multi ? `${clean(t.text)} (${clean(p.name)})` : clean(t.text);
    lines.push(`    ${label} :${tags(t, avail, today)}${clock}, ${dur}m`);
    clock = addMinutes(clock, dur);
  }
  lines.push(...bounds(`${today}T${opts.dayStart}`, `${today}T${opts.dayEnd}`));
  return lines.join("\n");
}

function addMinutes(stamp: string, min: number): string {
  const d = new Date(stamp + ":00Z");
  d.setUTCMinutes(d.getUTCMinutes() + min);
  return d.toISOString().slice(0, 16);
}
