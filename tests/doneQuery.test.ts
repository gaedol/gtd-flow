import { describe, it, expect } from "vitest";
import {
  parseDoneQuery,
  resolveRange,
  collectDone,
  groupDone,
  renderDoneMarkdown,
} from "../src/doneQuery";
import { Project, Task } from "../src/types";

const TODAY = "2026-07-15"; // a Wednesday

function task(text: string, extra: Partial<Task> = {}): Task {
  return { text, done: false, line: 0, indent: 0, tags: [], ...extra };
}

function project(name: string, path: string, tasks: Task[]): Project {
  return { path, name, status: "active", flow: "parallel", tasks };
}

describe("parseDoneQuery", () => {
  it("reads keys, ignoring blanks, comments and unknown keys", () => {
    const q = parseDoneQuery(`
      # last month's work
      range: last-month
      project: Kitchen
      folder: /Work/
      group: day
      limit: 20
      bogus: nope
    `);
    expect(q).toMatchObject({
      range: "last-month",
      project: "Kitchen",
      folder: "Work",
      group: "day",
      limit: 20,
    });
  });

  it("accepts include-list and boolean forms", () => {
    expect(parseDoneQuery("include: dropped, archived")).toMatchObject({
      includeDropped: true,
      includeArchived: true,
    });
    expect(parseDoneQuery("dropped: yes\narchived: true")).toMatchObject({
      includeDropped: true,
      includeArchived: true,
    });
  });

  it("defaults to project grouping, open items only", () => {
    expect(parseDoneQuery("")).toMatchObject({
      group: "project",
      includeDropped: false,
      includeArchived: false,
    });
  });
});

describe("resolveRange", () => {
  const r = (src: string) => resolveRange(parseDoneQuery(src), TODAY);

  it("explicit dates win over presets", () => {
    expect(r("range: today\nfrom: 2026-01-01\nto: 2026-03-31")).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });

  it("leaves an open end open", () => {
    expect(r("from: 2026-01-01").to).toBe("9999-12-31");
    expect(r("to: 2026-01-31").from).toBe("0000-01-01");
  });

  it("resolves week presets from Monday", () => {
    expect(r("range: this-week")).toEqual({ from: "2026-07-13", to: "2026-07-19" });
    expect(r("range: last-week")).toEqual({ from: "2026-07-06", to: "2026-07-12" });
  });

  it("resolves month, year and rolling presets", () => {
    expect(r("range: this-month")).toEqual({ from: "2026-07-01", to: "2026-07-31" });
    expect(r("range: last-month")).toEqual({ from: "2026-06-01", to: "2026-06-30" });
    expect(r("range: this-year")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(r("range: last-7-days")).toEqual({ from: "2026-07-09", to: TODAY });
    expect(r("range: last-30-days")).toEqual({ from: "2026-06-16", to: TODAY });
  });

  it("defaults to the last 7 days", () => {
    expect(r("")).toEqual({ from: "2026-07-09", to: TODAY });
  });
});

describe("collectDone", () => {
  const kitchen = project("Kitchen", "GTD/Projects/Home/Kitchen.md", [
    task("order tiles", { done: true, completedOn: "2026-07-10" }),
    task("book plumber", { done: true, completedOn: "2026-07-14" }),
    task("too old", { done: true, completedOn: "2026-05-01" }),
    task("abandoned", { done: true, dropped: true, cancelledOn: "2026-07-12", reason: "not needed" }),
    task("still open"),
  ]);
  const site = project("Website", "GTD/Projects/Work/Website.md", [
    task("ship copy", { done: true, completedOn: "2026-07-13" }),
  ]);
  const range = { from: "2026-07-09", to: "2026-07-15" };

  it("returns completed tasks in range, newest first", () => {
    const out = collectDone([kitchen, site], range, parseDoneQuery(""));
    expect(out.map((e) => e.task.text)).toEqual(["book plumber", "ship copy", "order tiles"]);
    expect(out.every((e) => e.state === "done")).toBe(true);
  });

  it("excludes dropped items unless asked", () => {
    const withDropped = collectDone([kitchen], range, parseDoneQuery("include: dropped"));
    expect(withDropped.map((e) => e.task.text)).toContain("abandoned");
    expect(withDropped.find((e) => e.task.text === "abandoned")!.state).toBe("dropped");
  });

  it("filters by project name and by folder", () => {
    const byName = collectDone([kitchen, site], range, parseDoneQuery("project: kitch"));
    expect(byName.every((e) => e.project.name === "Kitchen")).toBe(true);
    const byFolder = collectDone([kitchen, site], range, parseDoneQuery("folder: Work"));
    expect(byFolder.map((e) => e.task.text)).toEqual(["ship copy"]);
  });

  it("honours limit", () => {
    expect(collectDone([kitchen, site], range, parseDoneQuery("limit: 2"))).toHaveLength(2);
  });
});

describe("groupDone and markdown output", () => {
  const p = project("Kitchen", "GTD/Projects/Kitchen.md", []);
  const entries = [
    { project: p, task: task("b"), date: "2026-07-14", state: "done" as const },
    { project: p, task: task("a"), date: "2026-07-10", state: "done" as const },
  ];

  it("groups by day newest first", () => {
    expect(groupDone(entries, "day").map((g) => g.label)).toEqual(["2026-07-14", "2026-07-10"]);
  });

  it("renders a checklist that survives without the plugin", () => {
    const md = renderDoneMarkdown(entries, { from: "2026-07-09", to: "2026-07-15" }, parseDoneQuery(""));
    expect(md).toContain("2 done");
    expect(md).toContain("### Kitchen");
    expect(md).toContain("- [x] b ✅ 2026-07-14");
  });

  it("says so when nothing closed", () => {
    const md = renderDoneMarkdown([], { from: "2026-07-09", to: "2026-07-15" }, parseDoneQuery(""));
    expect(md).toContain("Nothing closed");
  });
});
