// natural-language date options for the picker; all resolve to an ISO date
// so stored task metadata stays plain YYYY-MM-DD (Tasks-compatible)

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fromISO(today: string): Date {
  return new Date(today + "T00:00:00Z");
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// next date on or after today that falls on the given weekday (0=Sun..6=Sat)
export function nextWeekday(today: string, dow: number): string {
  const d = fromISO(today);
  const diff = (dow - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return iso(d);
}

export function endOfWeek(today: string): string {
  return nextWeekday(today, 0); // upcoming Sunday
}

export function startOfNextWeek(today: string): string {
  const d = fromISO(today);
  const diff = (1 - d.getUTCDay() + 7) % 7 || 7; // strictly-future Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return iso(d);
}

export function endOfMonth(today: string): string {
  const d = fromISO(today);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

export function addDays(today: string, n: number): string {
  const d = fromISO(today);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export interface DateChoice {
  label: string;
  date: string;
}

// the ordered list of choices the suggester offers in date mode
export function dateChoices(today: string): DateChoice[] {
  const choices: DateChoice[] = [
    { label: "today", date: today },
    { label: "tomorrow", date: addDays(today, 1) },
  ];
  // weekday names, starting from tomorrow's weekday so "today/tomorrow" aren't duplicated
  for (let i = 0; i < 7; i++) {
    const dow = (fromISO(today).getUTCDay() + i) % 7;
    choices.push({ label: DOW[dow], date: nextWeekday(today, dow) });
  }
  choices.push(
    { label: "end of week", date: endOfWeek(today) },
    { label: "next week", date: startOfNextWeek(today) },
    { label: "in 2 weeks", date: addDays(today, 14) },
    { label: "end of month", date: endOfMonth(today) },
    { label: "in a month", date: addDays(today, 30) }
  );
  // de-dupe labels that resolved to the same calendar day as today/tomorrow
  const seen = new Set<string>();
  return choices.filter((c) => {
    const key = c.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
