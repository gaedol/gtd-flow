import { describe, it, expect } from "vitest";
import { assemble, NoteRecord } from "../src/projectAssembly";
import { Project, Task } from "../src/types";

function task(text: string, path: string): Task {
  return { text, path, done: false, line: 0, indent: 0, tags: [] };
}

function hub(path: string, tasks: Task[] = []): NoteRecord {
  const project: Project = { path, name: path.replace(/.*\//, "").replace(/\.md$/, ""), status: "active", flow: "sequential", tasks };
  return { kind: "project", project };
}

function member(name: string, path: string, link: string, tasks: Task[] = [], extra: Partial<Extract<NoteRecord, { kind: "member" }>> = {}): NoteRecord {
  return { kind: "member", name, link, explicit: true, fallbackInbox: true, tasks, ...extra };
}

// resolves a link by note name among the given paths
function resolver(paths: string[]) {
  return (link: string) => paths.find((p) => p.replace(/.*\//, "").replace(/\.md$/, "") === link) ?? null;
}

describe("assemble", () => {
  const HUB = "GTD/Projects/Kitchen.md";

  it("appends members' tasks after the hub's, members in name order", () => {
    const notes = new Map<string, NoteRecord>([
      ["Notes/b-quotes.md", member("b-quotes", "Notes/b-quotes.md", "Kitchen", [task("compare quotes", "Notes/b-quotes.md")])],
      [HUB, hub(HUB, [task("measure", HUB)])],
      ["Meetings/a-contractor.md", member("a-contractor", "Meetings/a-contractor.md", "Kitchen", [task("send plans", "Meetings/a-contractor.md")])],
    ]);
    const a = assemble(notes, resolver([...notes.keys()]));
    const p = a.projects.get(HUB)!;
    expect(p.tasks.map((t) => t.text)).toEqual(["measure", "send plans", "compare quotes"]);
    expect(p.members).toEqual(["Meetings/a-contractor.md", "Notes/b-quotes.md"]);
    expect(a.hubOf.get("Notes/b-quotes.md")).toBe(HUB);
    expect(a.projects.has("Notes/b-quotes.md")).toBe(false); // not also an inbox
    expect(a.broken).toEqual([]);
  });

  it("keeps a member without tasks in the project", () => {
    const notes = new Map<string, NoteRecord>([[HUB, hub(HUB)], ["Notes/plan.md", member("plan", "Notes/plan.md", "Kitchen")]]);
    expect(assemble(notes, resolver([...notes.keys()])).projects.get(HUB)!.members).toEqual(["Notes/plan.md"]);
  });

  it("reports a link to a missing note or a non-project, keeping its tasks in the inbox", () => {
    const notes = new Map<string, NoteRecord>([
      ["Notes/x.md", member("x", "Notes/x.md", "Nowhere", [task("orphan", "Notes/x.md")])],
      ["Notes/plain.md", { kind: "inbox", name: "plain", tasks: [task("p", "Notes/plain.md")] }],
      ["Notes/y.md", member("y", "Notes/y.md", "plain")],
    ]);
    const a = assemble(notes, resolver([...notes.keys()]));
    expect(a.broken.map((b) => [b.name, b.reason])).toEqual([
      ["x", 'links to "Nowhere", which doesn\'t exist'],
      ["y", 'links to "plain", which isn\'t a project'],
    ]);
    expect(a.projects.get("Notes/x.md")?.kind).toBe("inbox");
  });

  it("quietly ignores a plain-text project field that names no hub", () => {
    const notes = new Map<string, NoteRecord>([
      ["Notes/w.md", member("w", "Notes/w.md", "work", [task("t", "Notes/w.md")], { explicit: false })],
    ]);
    const a = assemble(notes, resolver([...notes.keys()]));
    expect(a.broken).toEqual([]);
    expect(a.projects.get("Notes/w.md")?.kind).toBe("inbox");
  });

  it("doesn't turn an unlinked member into an inbox where ordinary notes aren't inboxes", () => {
    const notes = new Map<string, NoteRecord>([
      ["Notes/w.md", member("w", "Notes/w.md", "Nowhere", [task("t", "Notes/w.md")], { fallbackInbox: false })],
    ]);
    const a = assemble(notes, resolver([...notes.keys()]));
    expect(a.projects.size).toBe(0);
    expect(a.broken.length).toBe(1);
  });
});
