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

  it("emits a zero-day header row carrying the project name", () => {
    const p = project("Home", { tasks: [task("t", { due: "2026-06-13" })] });
    const src = ganttSource([p], "week", TODAY, OPTS);
    expect(src).toContain(`Home :gtdhdr, ${TODAY}, 0d`);
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
    const p = project("P", { tasks: [task("x", { due: "2026-06-12" })] });
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
  it("shows only tasks due today, overdue, or deferred-until-today — stacked from dayStart", () => {
    const p = project("Home", {
      tasks: [
        task("write report", { durationMin: 90, due: "2026-06-12" }), // due today
        task("starts today", { defer: "2026-06-12" }),
      ],
    });
    const src = ganttSource([p], "day", TODAY, OPTS);
    expect(src).toContain("write report :active, 2026-06-12T09:00, 90m");
    expect(src).toContain("starts today :active, 2026-06-12T10:30, 30m");
  });

  it("excludes available-but-undated backlog tasks (the day is not the whole list)", () => {
    const p = project("Backlog", {
      tasks: [task("no date — available"), task("future", { defer: "2026-07-01" }), task("due", { due: "2026-06-12" })],
    });
    const src = ganttSource([p], "day", TODAY, OPTS);
    expect(src).toContain("due");
    expect(src).not.toContain("no date");
    expect(src).not.toContain("future");
  });

  it("orders overdue, then flagged, then due today, then starting today", () => {
    const a = project("A", {
      tasks: [task("starts", { defer: "2026-06-12" }), task("flagged", { due: "2026-06-12", tags: ["flag"] })],
    });
    const b = project("B", {
      tasks: [task("due today", { due: "2026-06-12" }), task("overdue", { due: "2026-06-01" })],
    });
    const src = ganttSource([a, b], "day", TODAY, OPTS);
    const order = ["overdue (B)", "flagged (A)", "due today (B)", "starts (A)"].map((l) => src.indexOf(l));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("pins ⏰ tasks at their time and flows untimed ones around them", () => {
    const p = project("Day", {
      tasks: [
        task("meeting", { due: "2026-06-12", durationMin: 60, startTime: "10:00" }),
        task("emails", { due: "2026-06-12", durationMin: 90 }), // 09:00+90 hits the 10:00 meeting
      ],
    });
    const src = ganttSource([p], "day", TODAY, OPTS);
    expect(src).toContain("meeting :active, 2026-06-12T10:00, 60m");
    // emails can't fit before the meeting (would overlap), so it jumps to 11:00
    expect(src).toContain("emails :active, 2026-06-12T11:00, 90m");
  });

  it("returns empty when nothing is dated to today", () => {
    const p = project("Seq", { tasks: [task("someday"), task("later", { defer: "2026-07-01" })] });
    expect(ganttSource([p], "day", TODAY, OPTS)).toBe("");
  });
});
