import { describe, it, expect } from "vitest";
import { taskContainers, projectNotes, inboxGroups } from "../src/selectors";
import { Project, Task } from "../src/types";

function task(text: string, extra: Partial<Task> = {}): Task {
  return { text, done: false, line: 0, indent: 0, tags: [], ...extra };
}

function project(name: string, path: string, tasks: Task[] = [], kind?: Project["kind"]): Project {
  return { path, name, kind, status: "active", flow: "parallel", tasks };
}

const snapshot = [
  project("Kitchen", "GTD/Projects/Kitchen.md", [task("tile")]),
  project("Meeting", "Notes/Meeting.md", [task("send deck"), task("filed", { done: true })], "inbox"),
  project("2026-10-01", "Daily/2026-10-01.md", [task("buy milk", { due: "2026-10-02" }), task("call mum")], "inbox"),
  project("Old", "Notes/Old.md", [task("finished", { done: true })], "inbox"),
];

describe("selectors", () => {
  it("taskContainers keeps everything including inbox notes", () => {
    expect(taskContainers(snapshot).map((p) => p.name)).toEqual(["Kitchen", "Meeting", "2026-10-01", "Old"]);
  });

  it("projectNotes drops inbox notes", () => {
    expect(projectNotes(snapshot).map((p) => p.name)).toEqual(["Kitchen"]);
  });

  it("inboxGroups groups open tasks by note, sorted by path, skipping empty notes", () => {
    const groups = inboxGroups(snapshot, false);
    expect(groups.map((g) => g.note.name)).toEqual(["2026-10-01", "Meeting"]);
    expect(groups.map((g) => g.tasks.map((t) => t.text))).toEqual([["buy milk", "call mum"], ["send deck"]]);
  });

  it("inboxGroups can leave out tasks that already have a due date", () => {
    const groups = inboxGroups(snapshot, true);
    expect(groups[0].tasks.map((t) => t.text)).toEqual(["call mum"]);
  });

  it("inboxGroups is empty when there are no inbox notes", () => {
    expect(inboxGroups([snapshot[0]], true)).toEqual([]);
  });
});
