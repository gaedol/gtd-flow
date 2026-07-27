import { describe, it, expect } from "vitest";
import { moveTaskBlock } from "../src/moveTaskLine";

// applies a move to a document, returning the resulting lines
function apply(doc: string, line: number, dir: "up" | "down"): string | null {
  const lines = doc.split("\n");
  const m = moveTaskBlock(lines, line, dir);
  if (!m) return null;
  return [...lines.slice(0, m.from), ...m.text.split("\n"), ...lines.slice(m.to + 1)].join("\n");
}

const flat = ["- [ ] a", "- [ ] b", "- [ ] c"].join("\n");

describe("moveTaskBlock — flat list", () => {
  it("moves a task up past its sibling", () => {
    expect(apply(flat, 1, "up")).toBe(["- [ ] b", "- [ ] a", "- [ ] c"].join("\n"));
  });

  it("moves a task down past its sibling", () => {
    expect(apply(flat, 1, "down")).toBe(["- [ ] a", "- [ ] c", "- [ ] b"].join("\n"));
  });

  it("refuses to move past the ends", () => {
    expect(moveTaskBlock(flat.split("\n"), 0, "up")).toBeNull();
    expect(moveTaskBlock(flat.split("\n"), 2, "down")).toBeNull();
  });

  it("reports where the moved task lands", () => {
    expect(moveTaskBlock(flat.split("\n"), 2, "up")!.cursorLine).toBe(1);
    expect(moveTaskBlock(flat.split("\n"), 0, "down")!.cursorLine).toBe(1);
  });
});

const nested = [
  "- [ ] first",
  "- [ ] group",
  "    - [ ] child one",
  "    - [ ] child two",
  "- [ ] last",
].join("\n");

describe("moveTaskBlock — subtrees", () => {
  it("carries children along when the parent moves", () => {
    expect(apply(nested, 1, "up")).toBe(
      ["- [ ] group", "    - [ ] child one", "    - [ ] child two", "- [ ] first", "- [ ] last"].join("\n")
    );
  });

  it("moves a parent down over the whole next sibling", () => {
    expect(apply(nested, 1, "down")).toBe(
      ["- [ ] first", "- [ ] last", "- [ ] group", "    - [ ] child one", "    - [ ] child two"].join("\n")
    );
  });

  it("reorders children within their group", () => {
    expect(apply(nested, 3, "up")).toBe(
      ["- [ ] first", "- [ ] group", "    - [ ] child two", "    - [ ] child one", "- [ ] last"].join("\n")
    );
  });

  it("a child cannot escape its group", () => {
    expect(moveTaskBlock(nested.split("\n"), 2, "up")).toBeNull();
    expect(moveTaskBlock(nested.split("\n"), 3, "down")).toBeNull();
  });
});

describe("moveTaskBlock — boundaries", () => {
  it("does not cross a non-task line into another list", () => {
    const doc = ["- [ ] a", "", "## Later", "- [ ] b"].join("\n");
    expect(moveTaskBlock(doc.split("\n"), 3, "up")).toBeNull();
    expect(moveTaskBlock(doc.split("\n"), 0, "down")).toBeNull();
  });

  it("ignores non-task lines", () => {
    expect(moveTaskBlock(["just text"], 0, "up")).toBeNull();
  });

  it("keeps metadata on the moved line intact", () => {
    const doc = ["- [ ] a", "- [x] b 📅 2026-08-01 ✅ 2026-07-25 #home"].join("\n");
    expect(apply(doc, 1, "up")).toBe(
      ["- [x] b 📅 2026-08-01 ✅ 2026-07-25 #home", "- [ ] a"].join("\n")
    );
  });
});
