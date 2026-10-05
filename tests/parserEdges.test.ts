import { describe, it, expect } from "vitest";
import { parseTaskLine, parseProject } from "../src/parser";

const p = (line: string) => parseTaskLine(line, 0);

describe("parser — line shapes", () => {
  it("accepts both bullet characters and upper-case X", () => {
    expect(p("* [ ] star bullet")?.text).toBe("star bullet");
    expect(p("- [X] shouty")?.done).toBe(true);
  });

  it("treats [-] as resolved-and-dropped, [/] as in progress", () => {
    const dropped = p("- [-] abandoned");
    expect(dropped).toMatchObject({ done: true, dropped: true });
    const prog = p("- [/] underway");
    expect(prog).toMatchObject({ done: false, inProgress: true });
  });

  it("requires text after the checkbox, so a bare checkbox is not a task", () => {
    expect(p("- [ ]")).toBeNull();
    expect(p("- [ ] ")?.text).toBe("");
  });

  it("ignores non-list lines", () => {
    expect(p("## Heading")).toBeNull();
    expect(p("[ ] no bullet")).toBeNull();
  });

  it("counts indent in characters, so a tab is one level-unit", () => {
    expect(p("\t- [ ] tabbed")?.indent).toBe(1);
    expect(p("    - [ ] spaced")?.indent).toBe(4);
  });
});

describe("parser — metadata", () => {
  it("falls back to ⏳ scheduled when there is no 🛫 start", () => {
    expect(p("- [ ] a ⏳ 2026-03-01")?.defer).toBe("2026-03-01");
    expect(p("- [ ] a 🛫 2026-02-01 ⏳ 2026-03-01")?.defer).toBe("2026-02-01");
  });

  it("reads durations in hours, minutes, or both", () => {
    expect(p("- [ ] a ⏱ 45m")?.durationMin).toBe(45);
    expect(p("- [ ] a ⏱ 2h")?.durationMin).toBe(120);
    expect(p("- [ ] a ⏱ 1h30m")?.durationMin).toBe(90);
    expect(p("- [ ] a")?.durationMin).toBeUndefined();
  });

  it("pads a single-digit time of day", () => {
    expect(p("- [ ] a ⏰ 9:30")?.startTime).toBe("09:30");
  });

  it("ends a 💬 reason at the next marker", () => {
    const t = p("- [-] a 💬 no longer needed ❌ 2026-05-05");
    expect(t?.reason).toBe("no longer needed");
    expect(t?.cancelledOn).toBe("2026-05-05");
  });

  it("captures a trailing block id and keeps it out of the text", () => {
    const t = p("- [ ] a task ^gtd-7f3a");
    expect(t?.blockId).toBe("gtd-7f3a");
    expect(t?.text).toBe("a task");
  });

  it("collects hierarchical and hyphenated tags, stripping them from the text", () => {
    const t = p("- [ ] call plumber #home/plumbing #next-up");
    expect(t?.tags).toEqual(["home/plumbing", "next-up"]);
    expect(t?.text).toBe("call plumber");
  });

  it("strips priority markers and all metadata from the text", () => {
    const t = p("- [x] write ⏫ report 📅 2026-04-01 🔁 every week ✅ 2026-04-02 #work");
    expect(t?.text).toBe("write report");
    expect(t).toMatchObject({ due: "2026-04-01", repeat: "every week", completedOn: "2026-04-02" });
  });
});

describe("parseProject", () => {
  it("only recognises notes whose frontmatter says type: project", () => {
    expect(parseProject("a.md", "- [ ] x", { type: "note" })).toBeNull();
    expect(parseProject("a.md", "- [ ] x", undefined)).toBeNull();
    expect(parseProject("a.md", "- [ ] x", { type: "project" })?.tasks.length).toBe(1);
  });

  it("derives the name from the filename and defaults status/flow", () => {
    const proj = parseProject("GTD/Projects/Deep/Kitchen reno.md", "", { type: "project" })!;
    expect(proj.name).toBe("Kitchen reno");
    expect(proj).toMatchObject({ status: "active", flow: "parallel" });
  });

  it("normalises unknown status and flow values", () => {
    const proj = parseProject("a.md", "", { type: "project", status: "bogus", flow: "sideways" })!;
    expect(proj).toMatchObject({ status: "active", flow: "parallel" });
  });

  it("accepts a Date object for review dates", () => {
    const proj = parseProject("a.md", "", {
      type: "project",
      "last-reviewed": new Date("2026-02-03T12:00:00Z"),
    })!;
    expect(proj.lastReviewed).toBe("2026-02-03");
  });

  it("records task line numbers against the whole document", () => {
    const proj = parseProject("a.md", "intro\n\n- [ ] first\ntext\n- [ ] second", { type: "project" })!;
    expect(proj.tasks.map((t) => t.line)).toEqual([2, 4]);
  });
});
