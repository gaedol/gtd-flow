import { describe, it, expect } from "vitest";
import { taskContainers, projectNotes, inboxTasks } from "../src/selectors";
import { Project, Task } from "../src/types";

const INBOX = "GTD/Inbox.md";

function task(text: string, extra: Partial<Task> = {}): Task {
  return { text, done: false, line: 0, indent: 0, tags: [], ...extra };
}

function project(name: string, path: string, tasks: Task[] = []): Project {
  return { path, name, status: "active", flow: "parallel", tasks };
}

const snapshot = [
  project("Kitchen", "GTD/Projects/Kitchen.md", [task("tile")]),
  project("Inbox", INBOX, [task("buy milk", { due: "2026-08-01" }), task("filed", { done: true })]),
];

describe("selectors", () => {
  it("taskContainers keeps everything including the inbox", () => {
    expect(taskContainers(snapshot).map((p) => p.name)).toEqual(["Kitchen", "Inbox"]);
  });

  it("projectNotes drops the inbox", () => {
    expect(projectNotes(snapshot, INBOX).map((p) => p.name)).toEqual(["Kitchen"]);
  });

  it("inboxTasks returns only the inbox's open tasks", () => {
    expect(inboxTasks(snapshot, INBOX).map((t) => t.text)).toEqual(["buy milk"]);
  });

  it("inboxTasks is empty when there is no inbox entry", () => {
    expect(inboxTasks([snapshot[0]], INBOX)).toEqual([]);
  });
});
