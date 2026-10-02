import { describe, it, expect } from "vitest";
import { parseTaskLine, parseProject, fileNameDate, applyFileDate } from "../src/parser";

describe("parseTaskLine", () => {
  it("parses a plain open task", () => {
    const t = parseTaskLine("- [ ] Buy milk", 0)!;
    expect(t.text).toBe("Buy milk");
    expect(t.done).toBe(false);
    expect(t.tags).toEqual([]);
  });

  it("parses Tasks-plugin emoji metadata", () => {
    const t = parseTaskLine(
      "- [ ] Draft proposal 🛫 2026-06-12 📅 2026-06-16 🔁 every week #errand #work/deep",
      3
    )!;
    expect(t.text).toBe("Draft proposal");
    expect(t.defer).toBe("2026-06-12");
    expect(t.due).toBe("2026-06-16");
    expect(t.repeat).toBe("every week");
    expect(t.tags).toEqual(["errand", "work/deep"]);
    expect(t.line).toBe(3);
  });

  it("reads a #YYYY-MM-DD tag as the due date and keeps it out of tags", () => {
    const t = parseTaskLine("- [ ] Renew passport #2026-10-15 #errand", 0)!;
    expect(t.due).toBe("2026-10-15");
    expect(t.tags).toEqual(["errand"]);
    expect(t.text).toBe("Renew passport");
  });

  it("lets an explicit 📅 win over a date tag", () => {
    const t = parseTaskLine("- [ ] Renew passport #2026-10-15 📅 2026-10-20", 0)!;
    expect(t.due).toBe("2026-10-20");
  });

  it("treats tags that merely start with a date as ordinary tags", () => {
    const t = parseTaskLine("- [ ] Plan #2026-10-15/offsite", 0)!;
    expect(t.due).toBeUndefined();
    expect(t.tags).toEqual(["2026-10-15/offsite"]);
  });

  it("parses dropped and in-progress statuses", () => {
    const dropped = parseTaskLine("- [-] Abandon idea ❌ 2026-06-10", 0)!;
    expect(dropped).toMatchObject({ done: true, dropped: true, cancelledOn: "2026-06-10", text: "Abandon idea" });
    const wip = parseTaskLine("- [/] Writing draft", 0)!;
    expect(wip).toMatchObject({ done: false, inProgress: true, text: "Writing draft" });
  });

  it("parses completed task with completion date", () => {
    const t = parseTaskLine("- [x] Ship it ✅ 2026-06-10", 1)!;
    expect(t.done).toBe(true);
    expect(t.completedOn).toBe("2026-06-10");
    expect(t.text).toBe("Ship it");
  });

  it("strips Tasks-plugin created date and priority, keeps text clean", () => {
    const t = parseTaskLine("- [ ] Call plumber ⏫ ➕ 2026-06-11 📅 2026-06-15", 0)!;
    expect(t.text).toBe("Call plumber");
    expect(t.due).toBe("2026-06-15");
  });

  it("uses ⏳ scheduled as defer when 🛫 is absent", () => {
    expect(parseTaskLine("- [ ] Later ⏳ 2026-06-20", 0)!.defer).toBe("2026-06-20");
    expect(parseTaskLine("- [ ] Later 🛫 2026-06-18 ⏳ 2026-06-20", 0)!.defer).toBe("2026-06-18");
  });

  it("parses a 💬 reason, stopping at the next marker, and strips it from text", () => {
    const t = parseTaskLine("- [-] Old vendor call 💬 superseded by new vendor ❌ 2026-07-03", 0)!;
    expect(t).toMatchObject({ dropped: true, reason: "superseded by new vendor", cancelledOn: "2026-07-03", text: "Old vendor call" });
    const open = parseTaskLine("- [ ] Task 💬 note to self 📅 2026-07-10", 0)!;
    expect(open).toMatchObject({ reason: "note to self", due: "2026-07-10", text: "Task" });
  });

  it("captures a trailing ^block-id and strips it from text", () => {
    const t = parseTaskLine("- [ ] Plan trip 📅 2026-06-20 ^gtd1a2b", 0)!;
    expect(t).toMatchObject({ text: "Plan trip", due: "2026-06-20", blockId: "gtd1a2b" });
  });

  it("parses ⏰ time of day and strips it from text", () => {
    const t = parseTaskLine("- [ ] Standup ⏰ 9:30 ⏱ 30m 📅 2026-06-20", 0)!;
    expect(t).toMatchObject({ text: "Standup", startTime: "09:30", durationMin: 30, due: "2026-06-20" });
  });

  it("parses ⏱ durations into minutes and strips them from text", () => {
    expect(parseTaskLine("- [ ] quick ⏱ 30m", 0)).toMatchObject({ text: "quick", durationMin: 30 });
    expect(parseTaskLine("- [ ] long ⏱ 1h30m 📅 2026-06-15", 0)).toMatchObject({
      text: "long",
      durationMin: 90,
      due: "2026-06-15",
    });
    expect(parseTaskLine("- [ ] hours ⏱ 2h", 0)!.durationMin).toBe(120);
  });

  it("captures indentation for nested tasks", () => {
    expect(parseTaskLine("- [ ] top", 0)!.indent).toBe(0);
    expect(parseTaskLine("  - [ ] nested", 1)!.indent).toBe(2);
    expect(parseTaskLine("\t- [ ] tab nested", 2)!.indent).toBe(1);
  });

  it("ignores non-task lines", () => {
    expect(parseTaskLine("some prose", 0)).toBeNull();
    expect(parseTaskLine("- bullet without checkbox", 0)).toBeNull();
  });
});

describe("parseProject", () => {
  const content = [
    "# Renovate kitchen",
    "- [ ] Measure space",
    "- [ ] Get quotes 🛫 2026-06-20",
    "- [x] Browse ideas ✅ 2026-06-01",
  ].join("\n");

  it("builds a project from frontmatter and tasks", () => {
    const p = parseProject("GTD/Projects/Kitchen.md", content, {
      type: "project",
      status: "active",
      flow: "sequential",
      "review-interval": "1w",
      "last-reviewed": "2026-06-10",
    })!;
    expect(p.name).toBe("Kitchen");
    expect(p.flow).toBe("sequential");
    expect(p.tasks).toHaveLength(3);
    expect(p.reviewInterval).toBe("1w");
    expect(p.lastReviewed).toBe("2026-06-10");
  });

  it("returns null without type: project", () => {
    expect(parseProject("x.md", content, { status: "active" })).toBeNull();
    expect(parseProject("x.md", content, undefined)).toBeNull();
  });

  it("defaults status/flow when missing", () => {
    const p = parseProject("x.md", content, { type: "project" })!;
    expect(p.status).toBe("active");
    expect(p.flow).toBe("parallel");
  });
});

describe("fileNameDate", () => {
  it("takes the first valid YYYY-MM-DD from the file name only", () => {
    expect(fileNameDate("Daily/2026-10-02.md")).toBe("2026-10-02");
    expect(fileNameDate("Meetings/2026-10-01 to 2026-10-07 sprint.md")).toBe("2026-10-01");
    expect(fileNameDate("2026-10-02/Standup.md")).toBeUndefined(); // folder, not file name
  });

  it("skips impossible dates and dates inside longer numbers", () => {
    expect(fileNameDate("Notes/2026-13-01 then 2026-02-28.md")).toBe("2026-02-28");
    expect(fileNameDate("Notes/2026-02-30.md")).toBeUndefined();
    expect(fileNameDate("Notes/12026-10-02.md")).toBeUndefined();
  });
});

describe("applyFileDate", () => {
  const PATH = "Meetings/2026-10-02 Standup.md";

  it("gives an undated open task the note's date, marked as inferred", () => {
    const t = applyFileDate(parseTaskLine("- [ ] send notes", 0)!, PATH);
    expect(t).toMatchObject({ due: "2026-10-02", dueFromFile: true });
  });

  it("leaves written due dates and done tasks alone", () => {
    expect(applyFileDate(parseTaskLine("- [ ] send notes 📅 2026-10-05", 0)!, PATH).due).toBe("2026-10-05");
    expect(applyFileDate(parseTaskLine("- [ ] send notes #2026-10-06", 0)!, PATH).due).toBe("2026-10-06");
    expect(applyFileDate(parseTaskLine("- [x] sent", 0)!, PATH).due).toBeUndefined();
  });
});
