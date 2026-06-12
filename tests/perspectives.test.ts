import { describe, it, expect } from "vitest";
import { runPerspective, Perspective } from "../src/perspectives";
import { Project, Task } from "../src/types";

const TODAY = "2026-06-12";

function task(text: string, extra: Partial<Task> = {}): Task {
  return { text, done: false, line: 0, indent: 0, tags: [], ...extra };
}

function project(name: string, extra: Partial<Project> = {}): Project {
  return { path: `GTD/Projects/${name}.md`, name, status: "active", flow: "parallel", tasks: [], ...extra };
}

function persp(extra: Partial<Perspective> = {}): Perspective {
  return { name: "t", availableOnly: true, flagged: false, tag: "", project: "", dueWithin: 0, groupBy: "project", ...extra };
}

describe("runPerspective", () => {
  const projects = [
    project("Home", {
      tasks: [
        task("fix sink", { tags: ["errand"], due: "2026-06-13" }),
        task("paint", { tags: ["flag"] }),
        task("done thing", { done: true }),
      ],
    }),
    project("Work", {
      flow: "sequential",
      tasks: [task("first", { due: "2026-08-01" }), task("second (blocked)", { tags: ["flag"] })],
    }),
  ];

  it("availableOnly respects sequential blocking", () => {
    const g = runPerspective(projects, persp(), TODAY, "flag");
    expect(g.get("Work")!.map((i) => i.task.text)).toEqual(["first"]);
  });

  it("flagged filter, including blocked tasks when availableOnly is off", () => {
    const on = runPerspective(projects, persp({ flagged: true }), TODAY, "flag");
    expect([...on.values()].flat().map((i) => i.task.text)).toEqual(["paint"]);
    const off = runPerspective(projects, persp({ flagged: true, availableOnly: false }), TODAY, "flag");
    expect([...off.values()].flat().map((i) => i.task.text)).toEqual(["paint", "second (blocked)"]);
  });

  it("tag and project filters", () => {
    const byTag = runPerspective(projects, persp({ tag: "errand" }), TODAY, "flag");
    expect([...byTag.values()].flat().map((i) => i.task.text)).toEqual(["fix sink"]);
    const byProject = runPerspective(projects, persp({ project: "wor" }), TODAY, "flag");
    expect([...byProject.keys()]).toEqual(["Work"]);
  });

  it("dueWithin window and due grouping", () => {
    const g = runPerspective(projects, persp({ dueWithin: 7, groupBy: "due" }), TODAY, "flag");
    expect([...g.keys()]).toEqual(["2026-06-13"]);
  });

  it("tag grouping puts multi-tag tasks in each group and hides structural tags", () => {
    const p = [project("P", { tasks: [task("x", { tags: ["a", "b", "flag", "parallel"] })] })];
    const g = runPerspective(p, persp({ groupBy: "tag" }), TODAY, "flag");
    expect([...g.keys()]).toEqual(["#a", "#b"]);
  });
});
