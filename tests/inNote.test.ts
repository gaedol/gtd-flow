import { describe, it, expect } from "vitest";
import { buildLineClasses } from "../src/inNote";
import { Project } from "../src/types";

const TODAY = "2026-06-11";

function project(extra: Partial<Project> = {}): Project {
  return { path: "p.md", name: "p", status: "active", flow: "parallel", tasks: [], ...extra };
}

describe("buildLineClasses", () => {
  it("marks next action, available, blocked in a sequential project", () => {
    const lines = ["# H", "- [x] a ✅ 2026-06-01", "- [ ] b", "- [ ] c"];
    const m = buildLineClasses(project({ flow: "sequential" }), lines, TODAY);
    expect(m.get(1)).toBeUndefined(); // done
    expect(m.get(2)).toBe("gtd-ln-next");
    expect(m.get(3)).toBe("gtd-ln-blocked");
  });

  it("marks deferred and overdue", () => {
    const lines = ["- [ ] now 📅 2026-06-01", "- [ ] later 🛫 2026-07-01"];
    const m = buildLineClasses(project(), lines, TODAY);
    expect(m.get(0)).toBe("gtd-ln-next gtd-ln-overdue");
    expect(m.get(1)).toBe("gtd-ln-deferred");
  });

  it("everything blocked when project on hold", () => {
    const m = buildLineClasses(project({ status: "on-hold" }), ["- [ ] a"], TODAY);
    expect(m.get(0)).toBe("gtd-ln-blocked");
  });

  it("parallel project: first available is next, rest available", () => {
    const m = buildLineClasses(project(), ["- [ ] a", "- [ ] b"], TODAY);
    expect(m.get(0)).toBe("gtd-ln-next");
    expect(m.get(1)).toBe("gtd-ln-available");
  });
});
