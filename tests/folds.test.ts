import { describe, it, expect } from "vitest";
import { setFolded, sectionKey, projectKey, noteKey } from "../src/folds";

const all = () => true;

describe("setFolded", () => {
  it("folds and unfolds keys", () => {
    const folded = setFolded([], [projectKey("P/A.md"), sectionKey("flagged")], true, all);
    expect(folded).toEqual(["project:P/A.md", "section:flagged"]);
    expect(setFolded(folded, [projectKey("P/A.md")], false, all)).toEqual(["section:flagged"]);
  });

  it("doesn't duplicate a key folded twice", () => {
    expect(setFolded([noteKey("n.md")], [noteKey("n.md")], true, all)).toEqual(["note:n.md"]);
  });

  it("drops keys for notes that are no longer indexed, but keeps sections", () => {
    const saved = [projectKey("gone.md"), noteKey("kept.md"), sectionKey("stalled")];
    const next = setFolded(saved, [], true, (p) => p === "kept.md");
    expect(next).toEqual(["note:kept.md", "section:stalled"]);
  });

  it("keeps paths that contain a colon intact", () => {
    expect(setFolded([], [projectKey("P/a:b.md")], true, (p) => p === "P/a:b.md")).toEqual(["project:P/a:b.md"]);
    expect(setFolded(["project:P/a:b.md"], [], true, (p) => p === "P/a:b.md")).toEqual(["project:P/a:b.md"]);
  });
});
