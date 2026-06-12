import { describe, it, expect } from "vitest";
import { insertTaskLine } from "../src/insertLine";

describe("insertTaskLine", () => {
  const note = ["# P", "- [ ] a", "- [ ] b", "", "## Archive", "- [x] old"].join("\n");

  it("bottom: after the last active task, above ## Archive", () => {
    expect(insertTaskLine(note, "- [ ] new", "bottom").split("\n")).toEqual([
      "# P", "- [ ] a", "- [ ] b", "- [ ] new", "", "## Archive", "- [x] old",
    ]);
  });

  it("top: before the first task", () => {
    expect(insertTaskLine(note, "- [ ] new", "top").split("\n")).toEqual([
      "# P", "- [ ] new", "- [ ] a", "- [ ] b", "", "## Archive", "- [x] old",
    ]);
  });

  it("no tasks yet: lands after the body, above Archive", () => {
    const empty = ["---", "type: project", "---", "", "## Archive"].join("\n");
    expect(insertTaskLine(empty, "- [ ] new", "top").split("\n")).toEqual([
      "---", "type: project", "---", "- [ ] new", "", "## Archive",
    ]);
  });

  it("plain note without archive: appends at end", () => {
    expect(insertTaskLine("- [ ] a", "- [ ] new", "bottom")).toBe("- [ ] a\n- [ ] new");
  });
});
