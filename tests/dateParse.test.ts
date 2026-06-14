import { describe, it, expect } from "vitest";
import { nextWeekday, endOfWeek, startOfNextWeek, endOfMonth, addDays, dateChoices } from "../src/dateParse";

// 2026-06-14 is a Sunday (UTC)
const SUN = "2026-06-14";

describe("date helpers", () => {
  it("nextWeekday returns today when today is that weekday", () => {
    expect(nextWeekday(SUN, 0)).toBe(SUN); // Sunday
  });

  it("nextWeekday finds the upcoming weekday", () => {
    expect(nextWeekday(SUN, 4)).toBe("2026-06-18"); // Thursday
    expect(nextWeekday(SUN, 1)).toBe("2026-06-15"); // Monday
  });

  it("endOfWeek is the upcoming Sunday", () => {
    expect(endOfWeek(SUN)).toBe(SUN);
    expect(endOfWeek("2026-06-15")).toBe("2026-06-21"); // from Monday
  });

  it("startOfNextWeek is the strictly-future Monday", () => {
    expect(startOfNextWeek(SUN)).toBe("2026-06-15");
    expect(startOfNextWeek("2026-06-15")).toBe("2026-06-22"); // from Monday → next Monday
  });

  it("endOfMonth handles month length", () => {
    expect(endOfMonth(SUN)).toBe("2026-06-30");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
  });

  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
  });
});

describe("dateChoices", () => {
  it("offers named days resolving to real dates, no duplicate labels", () => {
    const c = dateChoices(SUN);
    const labels = c.map((x) => x.label);
    expect(labels).toContain("today");
    expect(labels).toContain("Thursday");
    expect(labels).toContain("end of week");
    expect(labels).toContain("end of month");
    expect(new Set(labels).size).toBe(labels.length); // unique labels
    expect(c.find((x) => x.label === "Thursday")!.date).toBe("2026-06-18");
  });
});
