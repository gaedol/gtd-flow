import { describe, it, expect } from "vitest";
import { archiveDoneTasks } from "../src/archive";
import { insertTaskLine } from "../src/insertLine";

const TODAY = "2026-07-25";

describe("archiveDoneTasks", () => {
  it("leaves a done child inside an open group in place", () => {
    const doc = ["- [ ] group", "    - [x] child ✅ 2026-07-01", "- [x] alone ✅ 2026-07-01"].join("\n");
    const r = archiveDoneTasks(doc, TODAY, 7);
    expect(r.moved).toBe(1);
    expect(r.content).toContain("    - [x] child");
    expect(r.content.indexOf("## Archive")).toBeLessThan(r.content.indexOf("- [x] alone"));
  });

  it("moves a fully-done subtree as a unit", () => {
    const doc = ["- [x] parent ✅ 2026-07-01", "    - [x] kid ✅ 2026-07-02", "- [ ] open"].join("\n");
    const r = archiveDoneTasks(doc, TODAY, 7);
    expect(r.moved).toBe(2);
    expect(r.content.split("\n").filter((l) => l.includes("kid")).length).toBe(1);
  });

  it("respects the minimum age, counting from the closure date", () => {
    const doc = "- [x] fresh ✅ 2026-07-24";
    expect(archiveDoneTasks(doc, TODAY, 7).moved).toBe(0);
    expect(archiveDoneTasks(doc, TODAY, 1).moved).toBe(1);
    expect(archiveDoneTasks(doc, TODAY, 0).moved).toBe(1);
  });

  it("archives dropped tasks on their ❌ date", () => {
    expect(archiveDoneTasks("- [-] gone ❌ 2026-06-01", TODAY, 7).moved).toBe(1);
  });

  it("archives an undated done task on request, since its age is unknowable", () => {
    expect(archiveDoneTasks("- [x] no date", TODAY, 30).moved).toBe(1);
  });

  it("reuses an existing Archive heading instead of adding another", () => {
    const doc = ["- [x] old ✅ 2026-01-01", "", "## Archive", "- [x] older ✅ 2025-01-01"].join("\n");
    const r = archiveDoneTasks(doc, TODAY, 7);
    expect(r.content.match(/## Archive/g)?.length).toBe(1);
    expect(r.content).toContain("- [x] older");
  });

  it("never touches tasks already under the heading", () => {
    const doc = ["- [ ] open", "## Archive", "- [x] done ✅ 2026-01-01"].join("\n");
    expect(archiveDoneTasks(doc, TODAY, 7).moved).toBe(0);
  });

  it("is a no-op when nothing qualifies", () => {
    const doc = "- [ ] a\n- [ ] b";
    expect(archiveDoneTasks(doc, TODAY, 7)).toEqual({ content: doc, moved: 0 });
  });
});

describe("insertTaskLine", () => {
  const NEW = "- [ ] new";

  it("bottom lands after the last task", () => {
    const out = insertTaskLine("- [ ] a\n- [ ] b", NEW, "bottom");
    expect(out.split("\n")).toEqual(["- [ ] a", "- [ ] b", NEW]);
  });

  it("top lands before the first task", () => {
    const out = insertTaskLine("intro\n- [ ] a", NEW, "top");
    expect(out.split("\n")).toEqual(["intro", NEW, "- [ ] a"]);
  });

  it("stays above an Archive heading in both modes", () => {
    const doc = ["- [ ] a", "", "## Archive", "- [x] old"].join("\n");
    for (const pos of ["top", "bottom"] as const) {
      const lines = insertTaskLine(doc, NEW, pos).split("\n");
      expect(lines.indexOf(NEW)).toBeLessThan(lines.indexOf("## Archive"));
    }
  });

  it("top falls back to bottom when the note has no tasks", () => {
    expect(insertTaskLine("# Title", NEW, "top").split("\n")).toEqual(["# Title", NEW]);
  });

  it("inserts after frontmatter rather than inside it", () => {
    const doc = ["---", "type: project", "---", ""].join("\n");
    const lines = insertTaskLine(doc, NEW, "bottom").split("\n");
    expect(lines.filter((l) => l === "---").length).toBe(2);
    expect(lines.indexOf(NEW)).toBeGreaterThan(lines.lastIndexOf("---"));
  });

  it("handles an empty note", () => {
    expect(insertTaskLine("", NEW, "bottom").trim()).toBe(NEW);
  });
});
