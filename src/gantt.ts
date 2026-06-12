import { Project, Task } from "./types";
import { availableTasks, addInterval } from "./engine";

export type TimelineMode = "day" | "week" | "month";

export interface GanttOptions {
  dayStart: string; // "09:00"
  dayEnd: string; // "22:00"
  defaultDurationMin: number;
}

// invisible milestones (hidden via CSS) pin the axis to the full window
function bounds(from: string, to: string): string[] {
  return ["  section .", `    . :milestone, gtdb0, ${from}, 0d`, `    . :milestone, gtdb1, ${to}, 0d`];
}

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
      lines.push(`  section ${clean(p.name)}`, ...rows);
      any = true;
    }
  }
  if (!any) return "";
  lines.push(...bounds(today, end));
  return lines.join("\n");
}

function dayChart(projects: Project[], today: string, opts: GanttOptions): string {
  const lines = [
    "gantt",
    `  title Today — ${today}`,
    "  dateFormat YYYY-MM-DDTHH:mm",
    "  axisFormat %H",
    "  tickInterval 3hour",
  ];
  let clock = `${today}T${opts.dayStart}`;
  let any = false;
  for (const p of projects) {
    if (p.status !== "active") continue;
    const avail = new Set(availableTasks(p, today));
    const todays = p.tasks.filter(
      (t) => !t.done && (avail.has(t) || (t.due && t.due <= today))
    );
    if (todays.length === 0) continue;
    lines.push(`  section ${clean(p.name)}`);
    for (const t of todays) {
      const dur = t.durationMin ?? opts.defaultDurationMin;
      lines.push(`    ${clean(t.text)} :${tags(t, avail, today)}${clock}, ${dur}m`);
      clock = addMinutes(clock, dur);
      any = true;
    }
  }
  if (!any) return "";
  lines.push(...bounds(`${today}T${opts.dayStart}`, `${today}T${opts.dayEnd}`));
  return lines.join("\n");
}

function addMinutes(stamp: string, min: number): string {
  const d = new Date(stamp + ":00Z");
  d.setUTCMinutes(d.getUTCMinutes() + min);
  return d.toISOString().slice(0, 16);
}
