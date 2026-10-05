import { describe, it, expect } from "vitest";
import { parseTaskLine } from "../src/parser";
import { serializeTask, TaskFields } from "../src/serialize";
import { completeLine, setStateLine, toggleTagLine } from "../src/taskWrite";

const TODAY = "2026-07-25";

const lines = [
  "- [ ] plain",
  "    - [ ] indented #home/plumbing",
  "- [ ] dated 🛫 2026-08-01 📅 2026-08-10",
  "- [ ] timed ⏰ 09:00 ⏱ 1h30m",
  "- [ ] recurring 🔁 every 2 weeks 📅 2026-08-01",
  "- [x] finished ✅ 2026-07-20",
  "- [-] abandoned 💬 superseded ❌ 2026-07-21",
  "- [/] underway #work",
];

describe("parse → serialize round-trip", () => {
  it("reaches a fixed point after one canonicalisation", () => {
    for (const raw of lines) {
      const once = serializeTask(parseTaskLine(raw, 0) as TaskFields);
      const twice = serializeTask(parseTaskLine(once, 0) as TaskFields);
      expect(twice, `unstable for: ${raw}`).toBe(once);
    }
  });

  it("preserves every field a task carries", () => {
    for (const raw of lines) {
      const before = parseTaskLine(raw, 0)!;
      const after = parseTaskLine(serializeTask(before as TaskFields), 0)!;
      // toEqual, not toMatchObject: absent optional fields and explicit
      // undefined must compare equal here
      expect(after, `lost data for: ${raw}`).toEqual(before);
    }
  });
});

describe("write operations keep the line parseable and intact", () => {
  it("completing preserves all other metadata", () => {
    const raw = "    - [ ] mow lawn #home ⏰ 09:00 ⏱ 45m 🛫 2026-07-01 📅 2026-07-26";
    const { line } = completeLine(raw, TODAY);
    const t = parseTaskLine(line, 0)!;
    expect(t).toMatchObject({
      done: true,
      indent: 4,
      text: "mow lawn",
      tags: ["home"],
      startTime: "09:00",
      durationMin: 45,
      defer: "2026-07-01",
      due: "2026-07-26",
      completedOn: TODAY,
    });
  });

  it("state changes are idempotent and swap the status date", () => {
    const raw = "- [ ] thing 📅 2026-08-01";
    const done = setStateLine(raw, "done", TODAY);
    expect(setStateLine(done, "done", TODAY)).toBe(done);
    const dropped = setStateLine(done, "dropped", TODAY, "changed my mind");
    const t = parseTaskLine(dropped, 0)!;
    expect(t).toMatchObject({ dropped: true, cancelledOn: TODAY, reason: "changed my mind", due: "2026-08-01" });
    expect(t.completedOn).toBeUndefined();
  });

  it("reopening a closed task clears its status date", () => {
    const t = parseTaskLine(setStateLine("- [x] thing ✅ 2026-01-01", "todo", TODAY), 0)!;
    expect(t).toMatchObject({ done: false, completedOn: undefined });
  });

  it("toggling a tag twice returns the original line", () => {
    const raw = "- [ ] thing 📅 2026-08-01";
    const on = toggleTagLine(raw, [], "important");
    const off = toggleTagLine(on, parseTaskLine(on, 0)!.tags, "important");
    expect(off).toBe(raw);
  });

  it("a recurrence keeps the task's own text and tags", () => {
    const { next } = completeLine("- [ ] water plants #home 🔁 every 3 days 📅 2026-07-25", TODAY);
    const t = parseTaskLine(next!, 0)!;
    expect(t).toMatchObject({ done: false, text: "water plants", tags: ["home"], due: "2026-07-28" });
  });
});
