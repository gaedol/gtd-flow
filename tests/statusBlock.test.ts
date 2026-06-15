import { describe, it, expect } from "vitest";
import { statusBlockText, upsertStatusBlock, hasStatusBlock } from "../src/statusBlock";
import { Project, Task } from "../src/types";

const TODAY = "2026-06-14";

function task(text: string, extra: Partial<Task> = {}): Task {
  return { text, done: false, line: 0, indent: 0, tags: [], ...extra };
}

function project(extra: Partial<Project> = {}): Project {
  return { path: "p.md", name: "P", status: "active", flow: "parallel", tasks: [], ...extra };
}

describe("statusBlockText", () => {
  it("shows next action, progress and review", () => {
    const p = project({
      flow: "sequential",
      reviewInterval: "1w",
      lastReviewed: "2026-06-07",
      tasks: [task("a", { done: true }), task("b"), task("c")],
    });
    const t = statusBlockText(p, TODAY);
    expect(t).toContain("**Next action:** b");
    expect(t).toContain("1/3 · 1 available");
    expect(t).toContain("**Review:** due (last reviewed 7d ago)");
  });

  it("flags a stalled active project", () => {
    const p = project({ tasks: [task("blocked", { defer: "2026-07-01" })] });
    expect(statusBlockText(p, TODAY)).toContain("stalled");
  });

  it("omits review line when no interval", () => {
    expect(statusBlockText(project({ tasks: [task("x")] }), TODAY)).not.toContain("Review");
  });
});

describe("upsertStatusBlock", () => {
  it("inserts after frontmatter when missing", () => {
    const note = "---\ntype: project\n---\n\nBody text\n";
    const r = upsertStatusBlock(note, "**Next action:** x", true);
    expect(r.changed).toBe(true);
    expect(hasStatusBlock(r.content)).toBe(true);
    expect(r.content.indexOf("gtd:status")).toBeLessThan(r.content.indexOf("Body text"));
  });

  it("replaces an existing block and is idempotent", () => {
    const note = "%% gtd:status %%\nold\n%% /gtd:status %%\nrest";
    const r1 = upsertStatusBlock(note, "new", false);
    expect(r1.changed).toBe(true);
    expect(r1.content).toBe("%% gtd:status %%\nnew\n%% /gtd:status %%\nrest");
    const r2 = upsertStatusBlock(r1.content, "new", false);
    expect(r2.changed).toBe(false);
  });

  it("does not insert when missing and insertIfMissing is false", () => {
    const r = upsertStatusBlock("plain note", "x", false);
    expect(r.changed).toBe(false);
  });
});
