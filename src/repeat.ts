import { parseTaskLine } from "./parser";
import { addInterval } from "./engine";

export interface RepeatRule {
  n: number;
  unit: "d" | "w" | "m" | "y";
  whenDone: boolean;
}

const RULE_RE = /^every(?: (\d+))? *(day|week|month|year)s?( when done)?$/i;

export function parseRepeat(rule: string): RepeatRule | null {
  const m = rule.trim().match(RULE_RE);
  if (!m) return null;
  return {
    n: m[1] ? parseInt(m[1], 10) : 1,
    unit: m[2][0].toLowerCase() as RepeatRule["unit"],
    whenDone: !!m[3],
  };
}

const DATE_FIELD_RE = /([🛫📅⏳]) *(\d{4}-\d{2}-\d{2})/gu;

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayDiff(from: string, to: string): number {
  return Math.round(
    (new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000
  );
}

// Builds the next occurrence from the ORIGINAL (unchecked) line, or null if
// the task doesn't recur. Recurrence needs at least one date, as in Tasks.
export function nextOccurrenceLine(rawLine: string, today: string): string | null {
  const t = parseTaskLine(rawLine, 0);
  if (!t || !t.repeat) return null;
  const rule = parseRepeat(t.repeat);
  if (!rule) return null;
  const dates = [...rawLine.matchAll(DATE_FIELD_RE)];
  if (dates.length === 0) return null;

  const interval = `${rule.n}${rule.unit}`;
  let map: (d: string) => string;
  if (rule.whenDone) {
    // anchor on due (else first date); other dates keep their relative offset
    const base = t.due ?? dates[0][2];
    const shift = dayDiff(base, addInterval(today, interval)!);
    map = (d) => shiftDays(d, shift);
  } else {
    map = (d) => addInterval(d, interval)!;
  }
  return rawLine.replace(DATE_FIELD_RE, (_: string, emoji: string, d: string) => `${emoji} ${map(d)}`);
}
