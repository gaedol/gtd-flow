import { describe, it, expect } from "vitest";
import { resolveStyle } from "../src/projectColors";

const styles = {
  "GTD/Projects/Solutions": { backgroundColor: "#8b5a5a", textColor: "#fff", applyToFiles: true, applyToSubfolders: true },
  "GTD/Projects/Personal": { backgroundColor: "#5aa469", applyToFiles: true },
  "GTD/Projects/Scouts": { backgroundColor: "#a45aa4" }, // folder-only: files not colored
  "GTD/Projects/Personal/Viaggi - Londra.md": { backgroundColor: "#123456" },
};

describe("resolveStyle", () => {
  it("exact file path wins over ancestors", () => {
    expect(resolveStyle(styles, "GTD/Projects/Personal/Viaggi - Londra.md")!.backgroundColor).toBe("#123456");
  });

  it("direct parent applies when applyToFiles is set", () => {
    expect(resolveStyle(styles, "GTD/Projects/Personal/Cose da fare.md")!.backgroundColor).toBe("#5aa469");
  });

  it("deep descendant needs applyToSubfolders too", () => {
    expect(resolveStyle(styles, "GTD/Projects/Solutions/Sub/Deep.md")!.backgroundColor).toBe("#8b5a5a");
    expect(resolveStyle({ "A": { backgroundColor: "#111", applyToFiles: true } }, "A/Sub/x.md")).toBeNull();
  });

  it("folder style without applyToFiles does not color files", () => {
    expect(resolveStyle(styles, "GTD/Projects/Scouts/Camp.md")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(resolveStyle(styles, "Elsewhere/x.md")).toBeNull();
  });
});
