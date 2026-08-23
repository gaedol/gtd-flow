import { describe, it, expect } from "vitest";
import { stalledState, lastProgressDate, daysSinceProgress, isStale, attentionReason } from "../src/stalled";
import { Project, Task } from "../src/types";

const TODAY = "2026-07-25";

function task(text: string, extra: Partial<Task> = {}): Task {
  return { text, done: false, line: 0, indent: 0, tags: [], ...extra };
}

function project(extra: Partial<Project> = {}): Project {
  return { path: "GTD/Projects/P.md", name: "P", status: "active", flow: "parallel", tasks: [], ...extra };
}

describe("stalledState", () => {
  it("is null while any action is available", () => {
    expect(stalledState(project({ tasks: [task("do it")] }), TODAY)).toBeNull();
  });

  it("ignores non-active projects — parked is a choice, not a stall", () => {
    for (const status of ["on-hold", "someday", "completed", "dropped"] as const) {
      expect(stalledState(project({ status, tasks: [] }), TODAY)).toBeNull();
    }
  });

  it("flags an empty project", () => {
    expect(stalledState(project(), TODAY)?.kind).toBe("empty");
  });

  it("flags a project whose tasks are all closed", () => {
    const p = project({ tasks: [task("a", { done: true, completedOn: "2026-07-01" })] });
    expect(stalledState(p, TODAY)?.kind).toBe("all-closed");
  });

  it("flags a project parked task by task", () => {
    const p = project({ tasks: [task("later", { tags: ["someday"] })] });
    expect(stalledState(p, TODAY)?.kind).toBe("all-parked");
  });

  it("reports the wake-up date when everything is deferred", () => {
    const p = project({ tasks: [task("a", { defer: "2026-09-01" }), task("b", { defer: "2026-08-10" })] });
    const s = stalledState(p, TODAY)!;
    expect(s.kind).toBe("waiting");
    expect(s.until).toBe("2026-08-10");
    expect(s.reason).toContain("2026-08-10");
  });

  it("calls a sequential project blocked when its head is deferred", () => {
    const p = project({
      flow: "sequential",
      tasks: [task("first", { defer: "2026-09-01" }), task("second")],
    });
    expect(stalledState(p, TODAY)?.kind).toBe("blocked");
  });
});

describe("progress tracking", () => {
  const p = project({
    tasks: [
      task("a", { done: true, completedOn: "2026-06-01" }),
      task("b", { done: true, dropped: true, cancelledOn: "2026-07-05" }),
      task("c"),
    ],
  });

  it("takes the most recent ✅ or ❌ date", () => {
    expect(lastProgressDate(p)).toBe("2026-07-05");
    expect(daysSinceProgress(p, TODAY)).toBe(20);
  });

  it("falls back to a supplied date when nothing was ever closed", () => {
    const fresh = project({ tasks: [task("new")] });
    expect(lastProgressDate(fresh)).toBeUndefined();
    expect(daysSinceProgress(fresh, TODAY, "2026-07-20")).toBe(5);
    expect(daysSinceProgress(fresh, TODAY)).toBeUndefined();
  });

  it("is stale past the threshold, and never when disabled", () => {
    expect(isStale(p, TODAY, 14)).toBe(true);
    expect(isStale(p, TODAY, 30)).toBe(false);
    expect(isStale(p, TODAY, 0)).toBe(false);
  });
});

describe("attentionReason", () => {
  it("prefers the stall reason over staleness", () => {
    const p = project({ tasks: [task("a", { done: true, completedOn: "2026-01-01" })] });
    expect(attentionReason(p, TODAY, 14)).toContain("every task closed");
  });

  it("reports staleness for a project that is merely idle", () => {
    const p = project({ tasks: [task("a", { done: true, completedOn: "2026-06-01" }), task("b")] });
    expect(attentionReason(p, TODAY, 14)).toBe("no progress in 54 days");
  });

  it("is null for a healthy project", () => {
    const p = project({ tasks: [task("a", { done: true, completedOn: TODAY }), task("b")] });
    expect(attentionReason(p, TODAY, 14)).toBeNull();
  });
});
