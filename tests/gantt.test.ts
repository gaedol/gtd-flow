import { describe, it, expect } from "vitest";
import { ganttSource } from "../src/gantt";
import { Project, Task } from "../src/types";

const TODAY = "2026-06-12";
const OPTS = { dayStart: "09:00", dayEnd: "22:00", defaultDurationMin: 30, flagTag: "flag" };

function task(text: string, extra: Partial<Task> = {}): Task {
  return { text, done: false, line: 0, indent: 0, tags: [], ...extra };
}

function project(name: string, extra: Partial<Project> = {}): Project {
  return { path: `p/${name}.md`, name, status: "active", flow: "parallel", tasks: [], ...extra };
}

describe("ganttSource week/month", () => {
  it("spans defer→due, marks overdue crit on today, available active", () => {
    const p = project("Home", {
      tasks: [
        task("window task", { defer: "2026-06-13", due: "2026-06-16" }),
        task("overdue", { due: "2026-06-01" }),
        task("done", { done: true, due: "2026-06-14" }),
      ],
    });
    const src = ganttSource([p], "week", TODAY, OPTS);
    expect(src).toContain("section Home");
    expect(src).toContain("window task :2026-06-13, 2026-06-16"); // deferred → not active yet
    expect(src).toContain("overdue :crit, 2026-06-12, 1d");
    expect(src).not.toContain("done");
  });

  it("sanitizes mermaid syntax characters and skips dateless tasks", () => {
    const p = project("P", {
      tasks: [task("call: bank, #urgent", { due: "2026-06-13" }), task("no dates")],
    });
    const src = ganttSource([p], "week", TODAY, OPTS);
    expect(src).toContain("call bank urgent :");
    expect(src).not.toContain("no dates");
  });

  it("clips bars at the window edge so the axis never stretches", () => {
    const p = project("P", {
      tasks: [task("long one", { defer: "2026-06-14", due: "2026-07-30" })],
    });
    const week = ganttSource([p], "week", TODAY, OPTS);
    expect(week).toContain("long one :2026-06-14, 2026-06-18"); // today+6d
  });

  it("pins the axis with boundary milestones for the full window", () => {
    const p = project("P", { tasks: [task("x", { due: "2026-06-13" })] });
    const week = ganttSource([p], "week", TODAY, OPTS);
    expect(week).toContain(". :milestone, gtdb0, 2026-06-12, 0d");
    expect(week).toContain(". :milestone, gtdb1, 2026-06-18, 0d");
    const day = ganttSource([p], "day", TODAY, OPTS);
    expect(day).toContain(". :milestone, gtdb0, 2026-06-12T09:00, 0d");
    expect(day).toContain(". :milestone, gtdb1, 2026-06-12T22:00, 0d");
  });

  it("returns empty string when nothing is chartable", () => {
    expect(ganttSource([project("Empty")], "month", TODAY, OPTS)).toBe("");
  });
});

describe("ganttSource day", () => {
  it("stacks today's tasks from dayStart using durations", () => {
    const p = project("Home", {
      tasks: [
        task("write report", { durationMin: 90, due: "2026-06-12" }),
        task("emails"),
      ],
    });
    const src = ganttSource([p], "day", TODAY, OPTS);
    expect(src).toContain("write report :active, 2026-06-12T09:00, 90m"); // due today = active, not crit
    expect(src).toContain("emails :active, 2026-06-12T10:30, 30m");
  });

  it("orders by urgency: overdue, flagged, due today, rest — across projects", () => {
    const a = project("A", {
      tasks: [task("plain a"), task("flagged", { tags: ["flag"] })],
    });
    const b = project("B", {
      tasks: [task("due today", { due: "2026-06-12" }), task("overdue", { due: "2026-06-01" })],
    });
    const src = ganttSource([a, b], "day", TODAY, OPTS);
    const order = ["overdue (B)", "flagged (A)", "due today (B)", "plain a (A)"].map((l) =>
      src.indexOf(l)
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("excludes blocked and deferred tasks", () => {
    const p = project("Seq", {
      flow: "sequential",
      tasks: [task("first"), task("second"), task("later", { defer: "2026-07-01" })],
    });
    const src = ganttSource([p], "day", TODAY, OPTS);
    expect(src).toContain("first");
    expect(src).not.toContain("second");
    expect(src).not.toContain("later");
  });
});
