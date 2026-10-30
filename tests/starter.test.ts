import { describe, it, expect } from "vitest";
import { starterFiles } from "../src/starter";
import { parseProject, parseTaskLine } from "../src/parser";
import { availableTasks } from "../src/engine";

const TODAY = "2026-10-30";
const files = starterFiles("GTD/Projects", "GTD/Inbox.md", TODAY);

describe("starterFiles", () => {
  it("creates the inbox and two projects under the configured paths", () => {
    expect(files.map((f) => f.path)).toEqual([
      "GTD/Inbox.md",
      "GTD/Projects/Example - Weekend trip.md",
      "GTD/Projects/Example - Home.md",
    ]);
  });

  it("puts three open items in the inbox", () => {
    const tasks = files[0].content.split("\n").map((l, i) => parseTaskLine(l, i)).filter(Boolean);
    expect(tasks).toHaveLength(3);
  });

  it("the trip is sequential: only its first step is available", () => {
    const p = parseProject(files[1].path, files[1].content, { type: "project", flow: "sequential" })!;
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["Pick a destination"]);
  });

  it("the home project shows defer, waiting and someday staying out of next actions", () => {
    const p = parseProject(files[2].path, files[2].content, { type: "project", flow: "parallel" })!;
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["Fix the dripping tap", "Renew the home insurance"]);
    expect(p.tasks.find((t) => t.text === "Book the train")).toBeUndefined();
    expect(files[2].content).toContain("📅 2026-11-02");
  });
});
