import { describe, it, expect } from "vitest";
import {
  availableTasks,
  hasOpenSubtasks,
  datedActionable,
  datedVisible,
  overdueCount,
  dueOrOverdue,
  forecast,
  addInterval,
  isDueForReview,
} from "../src/engine";
import { Project, Task } from "../src/types";

const TODAY = "2026-07-25";

function task(text: string, extra: Partial<Task> = {}): Task {
  return { text, done: false, line: 0, indent: 0, tags: [], ...extra };
}

function project(extra: Partial<Project> = {}): Project {
  return { path: "GTD/Projects/P.md", name: "P", status: "active", flow: "parallel", tasks: [], ...extra };
}

describe("action groups and flow overrides", () => {
  it("#sequential on a parent orders its children inside a parallel project", () => {
    const p = project({
      tasks: [
        task("group", { tags: ["sequential"] }),
        task("step one", { indent: 4 }),
        task("step two", { indent: 4 }),
        task("elsewhere"),
      ],
    });
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["step one", "elsewhere"]);
  });

  it("#parallel on a parent frees its children inside a sequential project", () => {
    const p = project({
      flow: "sequential",
      tasks: [
        task("group", { tags: ["parallel"] }),
        task("a", { indent: 4 }),
        task("b", { indent: 4 }),
        task("later"),
      ],
    });
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["a", "b"]);
  });

  it("descends through nested groups to the first actionable leaf", () => {
    const p = project({
      flow: "sequential",
      tasks: [
        task("outer"),
        task("inner", { indent: 2 }),
        task("leaf", { indent: 4 }),
      ],
    });
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["leaf"]);
  });

  it("a finished group does not block what follows", () => {
    const p = project({
      flow: "sequential",
      tasks: [task("done group", { done: true }), task("child", { indent: 4, done: true }), task("next")],
    });
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["next"]);
  });

  it("a deferred child leaves its parent group unactionable", () => {
    const p = project({
      tasks: [task("group"), task("kid", { indent: 4, defer: "2026-09-01" })],
    });
    expect(availableTasks(p, TODAY)).toEqual([]);
  });
});

describe("task classification helpers", () => {
  const tasks = [task("parent"), task("kid", { indent: 4 }), task("solo"), task("parked", { tags: ["someday"] })];

  it("hasOpenSubtasks sees only deeper following lines", () => {
    expect(hasOpenSubtasks(tasks, 0)).toBe(true);
    expect(hasOpenSubtasks(tasks, 2)).toBe(false);
  });

  it("datedActionable excludes containers and parked tasks", () => {
    expect(datedActionable(tasks, 0)).toBe(false); // container
    expect(datedActionable(tasks, 2)).toBe(true);
    expect(datedActionable(tasks, 3)).toBe(false); // someday
  });

  it("datedVisible hides only closed and parked tasks", () => {
    expect(datedVisible(task("a"))).toBe(true);
    expect(datedVisible(task("a", { done: true }))).toBe(false);
    expect(datedVisible(task("a", { tags: ["someday"] }))).toBe(false);
  });
});

describe("badge and notification counts", () => {
  const p = project({
    tasks: [
      task("overdue", { due: "2026-07-01" }),
      task("due today", { due: TODAY }),
      task("later", { due: "2026-12-01" }),
      task("closed", { done: true, due: "2026-07-01" }),
      task("parked", { tags: ["someday"], due: "2026-07-01" }),
    ],
  });

  it("overdueCount counts only open, unparked, past-due actions", () => {
    expect(overdueCount([p], TODAY)).toBe(1);
  });

  it("dueOrOverdue includes today but not the future", () => {
    expect(dueOrOverdue([p], TODAY).map((i) => i.task.text)).toEqual(["overdue", "due today"]);
  });

  it("both skip non-active projects", () => {
    const held = project({ status: "on-hold", tasks: [task("x", { due: "2026-07-01" })] });
    expect(overdueCount([held], TODAY)).toBe(0);
    expect(dueOrOverdue([held], TODAY)).toEqual([]);
  });
});

describe("forecast placement", () => {
  it("surfaces overdue items under today rather than their own date", () => {
    const p = project({ tasks: [task("late", { due: "2026-01-01" })] });
    expect(forecast([p], TODAY, 7)[0]).toMatchObject({ date: TODAY, kind: "due" });
  });

  it("excludes anything past the horizon", () => {
    const p = project({ tasks: [task("far", { due: "2026-09-01" })] });
    expect(forecast([p], TODAY, 7)).toEqual([]);
  });

  it("marks a blocked but dated task unavailable while still listing it", () => {
    const p = project({
      flow: "sequential",
      tasks: [task("first"), task("second", { due: "2026-07-26" })],
    });
    const item = forecast([p], TODAY, 7).find((i) => i.task.text === "second")!;
    expect(item.available).toBe(false);
  });
});

describe("intervals and review", () => {
  it("handles each unit and rejects nonsense", () => {
    expect(addInterval(TODAY, "3d")).toBe("2026-07-28");
    expect(addInterval(TODAY, "2w")).toBe("2026-08-08");
    expect(addInterval(TODAY, "1m")).toBe("2026-08-25");
    expect(addInterval(TODAY, "1y")).toBe("2027-07-25");
    expect(addInterval(TODAY, "soon")).toBeUndefined();
  });

  it("a never-reviewed project with an interval is always due", () => {
    expect(isDueForReview(project({ reviewInterval: "1w" }), TODAY)).toBe(true);
  });

  it("no interval means never due, and non-active projects are skipped", () => {
    expect(isDueForReview(project({}), TODAY)).toBe(false);
    expect(isDueForReview(project({ status: "on-hold", reviewInterval: "1w" }), TODAY)).toBe(false);
  });

  it("becomes due once the interval has elapsed", () => {
    const p = project({ reviewInterval: "1w", lastReviewed: "2026-07-18" });
    expect(isDueForReview(p, TODAY)).toBe(true);
    expect(isDueForReview({ ...p, lastReviewed: "2026-07-24" }, TODAY)).toBe(false);
  });
});
