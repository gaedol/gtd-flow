import { describe, it, expect } from "vitest";
import { projectLabelFor, labelOf } from "../src/projectLabel";
import { runPerspective, Perspective } from "../src/perspectives";
import { groupDone, collectDone, parseDoneQuery } from "../src/doneQuery";
import { Project, Task } from "../src/types";

const ROOT = "GTD/Projects";

describe("projectLabelFor", () => {
  it("keeps a top-level project's plain name", () => {
    expect(projectLabelFor("GTD/Projects/Kitchen.md", ROOT)).toBe("Kitchen");
  });

  it("prefixes the folder (area) for nested projects, at any depth", () => {
    expect(projectLabelFor("GTD/Projects/Work/Q4 Planning.md", ROOT)).toBe("Work/Q4 Planning");
    expect(projectLabelFor("GTD/Projects/Work/Clients/Acme.md", ROOT)).toBe("Work/Clients/Acme");
  });

  it("tolerates a trailing slash in the setting and falls back to the name outside it", () => {
    expect(projectLabelFor("GTD/Projects/Work/Q4.md", "GTD/Projects/")).toBe("Work/Q4");
    expect(projectLabelFor("Elsewhere/Thing.md", ROOT)).toBe("Thing");
  });

  it("labelOf falls back to the name when unlabelled", () => {
    expect(labelOf({ path: "x.md", name: "Inbox", status: "active", flow: "parallel", tasks: [] })).toBe("Inbox");
  });
});

// two projects that share a name, in different areas
const task = (text: string, extra: Partial<Task> = {}): Task => ({ text, done: false, line: 0, indent: 0, tags: [], ...extra });
const twin = (folder: string, t: Task): Project => ({
  path: `${ROOT}/${folder}/Planning.md`,
  name: "Planning",
  label: `${folder}/Planning`,
  status: "active",
  flow: "parallel",
  tasks: [t],
});

describe("same-named projects in different areas stay apart", () => {
  const home = twin("Home", task("paint", { done: true, completedOn: "2026-10-15" }));
  const work = twin("Work", task("budget", { done: true, completedOn: "2026-10-15" }));

  it("in perspectives grouped by project", () => {
    const open = [twin("Home", task("paint")), twin("Work", task("budget"))];
    const p: Perspective = { name: "t", availableOnly: false, flagged: false, tag: "", project: "", dueWithin: 0, groupBy: "project" };
    const g = runPerspective(open, p, "2026-10-17", "flag");
    expect([...g.keys()]).toEqual(["Home/Planning", "Work/Planning"]);
  });

  it("in done queries grouped by project", () => {
    const q = parseDoneQuery("range: all");
    const groups = groupDone(collectDone([home, work], { from: "0000-01-01", to: "9999-12-31" }, q), "project");
    expect(groups.map((g) => g.label)).toEqual(["Home/Planning", "Work/Planning"]);
  });
});
