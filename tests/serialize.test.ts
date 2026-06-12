import { describe, it, expect } from "vitest";
import { serializeTask, formatDuration, parseDuration } from "../src/serialize";
import { parseTaskLine } from "../src/parser";

describe("duration helpers", () => {
  it("round-trips common durations", () => {
    for (const [min, s] of [[30, "30m"], [120, "2h"], [90, "1h30m"]] as [number, string][]) {
      expect(formatDuration(min)).toBe(s);
      expect(parseDuration(s)).toBe(min);
    }
    expect(parseDuration("soon")).toBeUndefined();
  });
});

describe("serializeTask", () => {
  it("produces a line the parser reads back identically", () => {
    const line = serializeTask({
      indent: 2,
      done: false,
      text: "Call plumber",
      tags: ["errand", "flag"],
      repeat: "every week",
      defer: "2026-06-15",
      due: "2026-06-20",
      durationMin: 45,
    });
    expect(line).toBe(
      "  - [ ] Call plumber #errand #flag 🔁 every week 🛫 2026-06-15 📅 2026-06-20 ⏱ 45m"
    );
    const back = parseTaskLine(line, 0)!;
    expect(back).toMatchObject({
      text: "Call plumber",
      tags: ["errand", "flag"],
      repeat: "every week",
      defer: "2026-06-15",
      due: "2026-06-20",
      durationMin: 45,
      indent: 2,
      done: false,
    });
  });

  it("keeps completion state and date", () => {
    const line = serializeTask({
      indent: 0, done: true, completedOn: "2026-06-10", text: "Done", tags: [],
    });
    expect(line).toBe("- [x] Done ✅ 2026-06-10");
  });
});
