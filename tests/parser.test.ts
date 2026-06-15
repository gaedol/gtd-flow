import { describe, it, expect } from "vitest";
import { parseTaskLine, parseProject } from "../src/parser";

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
