import { describe, it, expect } from "vitest";
import { isAvailable, availableTasks, nextAction, addInterval, isDueForReview, forecast } from "../src/engine";
import { Project, Task } from "../src/types";

const TODAY = "2026-06-11";

function task(text: string, extra: Partial<Task> = {}): Task {
  return { text, done: false, line: 0, indent: 0, tags: [], ...extra };
}

function project(extra: Partial<Project> = {}): Project {
  return {
    path: "GTD/Projects/P.md",
    name: "P",
    status: "active",
    flow: "parallel",
    tasks: [],
    ...extra,
  };
}

describe("availability", () => {
  it("all open undeferred tasks available in parallel projects", () => {
    const p = project({ tasks: [task("a"), task("b"), task("c", { done: true })] });
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["a", "b"]);
  });

  it("only first open task available in sequential projects", () => {
    const p = project({
      flow: "sequential",
      tasks: [task("a", { done: true }), task("b"), task("c")],
    });
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["b"]);
    expect(nextAction(p, TODAY)?.text).toBe("b");
  });

  it("deferred tasks are unavailable until their date", () => {
    const t = task("later", { defer: "2026-06-20" });
    const p = project({ tasks: [t] });
    expect(isAvailable(t, p, TODAY)).toBe(false);
    expect(isAvailable(t, p, "2026-06-20")).toBe(true);
  });

  it("nothing available in non-active projects", () => {
    const p = project({ status: "on-hold", tasks: [task("a")] });
    expect(availableTasks(p, TODAY)).toEqual([]);
  });

  it("sequential next action blocked by a deferred first task", () => {
    const p = project({
      flow: "sequential",
      tasks: [task("a", { defer: "2026-07-01" }), task("b")],
    });
    expect(availableTasks(p, TODAY)).toEqual([]);
  });
});

describe("action groups (indentation)", () => {
  it("a group with open children is not actionable; children follow group flow", () => {
    const p = project({
      flow: "sequential",
      tasks: [
        task("group"),
        task("child a", { indent: 2 }),
        task("child b", { indent: 2 }),
        task("after group"),
      ],
    });
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["child a"]);
  });

  it("#parallel on the parent overrides sequential flow for its children", () => {
    const p = project({
      flow: "sequential",
      tasks: [
        task("group", { tags: ["parallel"] }),
        task("child a", { indent: 2 }),
        task("child b", { indent: 2 }),
      ],
    });
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["child a", "child b"]);
  });

  it("parent becomes available once all children are done", () => {
    const p = project({
      tasks: [
        task("group"),
        task("child a", { indent: 2, done: true }),
        task("child b", { indent: 2, done: true }),
      ],
    });
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["group"]);
  });

  it("a deferred parent defers its whole subtree", () => {
    const p = project({
      tasks: [task("group", { defer: "2026-07-01" }), task("child", { indent: 2 })],
    });
    expect(availableTasks(p, TODAY)).toEqual([]);
  });

  it("completing the group line unblocks the next sequential sibling", () => {
    const p = project({
      flow: "sequential",
      tasks: [
        task("group", { done: true }),
        task("child", { indent: 2, done: true }),
        task("after"),
      ],
    });
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["after"]);
  });
});

describe("addInterval", () => {
  it("handles d/w/m/y", () => {
    expect(addInterval("2026-06-11", "3d")).toBe("2026-06-14");
    expect(addInterval("2026-06-11", "2w")).toBe("2026-06-25");
    expect(addInterval("2026-06-11", "1m")).toBe("2026-07-11");
    expect(addInterval("2026-06-11", "1y")).toBe("2027-06-11");
  });

  it("rejects malformed intervals", () => {
    expect(addInterval("2026-06-11", "soon")).toBeUndefined();
  });
});

describe("review", () => {
  it("due when lastReviewed + interval has passed", () => {
    expect(isDueForReview(project({ reviewInterval: "1w", lastReviewed: "2026-06-01" }), TODAY)).toBe(true);
    expect(isDueForReview(project({ reviewInterval: "1w", lastReviewed: "2026-06-10" }), TODAY)).toBe(false);
  });

  it("never-reviewed projects with an interval are due", () => {
    expect(isDueForReview(project({ reviewInterval: "1w" }), TODAY)).toBe(true);
  });

  it("no interval means never due", () => {
    expect(isDueForReview(project(), TODAY)).toBe(false);
  });
});

describe("forecast", () => {
  it("a task with a due date appears once, on the due day, regardless of defer", () => {
    const same = project({ tasks: [task("both", { defer: "2026-06-12", due: "2026-06-12" })] });
    expect(forecast([same], TODAY, 7)).toHaveLength(1);
    const diff = project({ tasks: [task("both", { defer: "2026-06-13", due: "2026-06-15" })] });
    const items = forecast([diff], TODAY, 7);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "due", date: "2026-06-15" });
  });

  it("defer-only tasks appear on their defer date", () => {
    const p = project({ tasks: [task("later", { defer: "2026-06-14" })] });
    expect(forecast([p], TODAY, 7)[0]).toMatchObject({ kind: "becomes-available", date: "2026-06-14" });
  });

  it("collects due and becoming-available items in window, overdue on today", () => {
    const p = project({
      tasks: [
        task("overdue", { due: "2026-06-01" }),
        task("due soon", { due: "2026-06-13" }),
        task("defers in", { defer: "2026-06-14" }),
        task("far away", { due: "2026-09-01" }),
        task("done", { done: true, due: "2026-06-12" }),
      ],
    });
    const items = forecast([p], TODAY, 7);
    expect(items.map((i) => [i.task.text, i.date, i.kind])).toEqual([
      ["overdue", TODAY, "due"],
      ["due soon", "2026-06-13", "due"],
      ["defers in", "2026-06-14", "becomes-available"],
    ]);
  });
});
