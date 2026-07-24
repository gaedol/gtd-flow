import { App, Notice, TFile } from "obsidian";
import { Task } from "./types";
import { parseTaskLine } from "./parser";
import { todayISO } from "./dates";
import { TaskState } from "./serialize";
import { completeLine, setStateLine } from "./taskWrite";

export async function completeTask(app: App, path: string, task: Task): Promise<boolean> {
  const file = app.vault.getFileByPath(path);
  if (!(file instanceof TFile)) return false;
  let ok = false;
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    const line = lines[task.line];
    // guard against the file having shifted since indexing
    const current = line !== undefined ? parseTaskLine(line, task.line) : null;
    if (!current || current.done || current.text !== task.text) {
      new Notice("Task moved since last index — try again");
      return content;
    }
    const { line: done, next } = completeLine(line, todayISO());
    lines[task.line] = done;
    if (next) lines.splice(task.line, 0, next);
    ok = true;
    return lines.join("\n");
  });
  return ok;
}

// surgical status change preserving all other metadata; for drop/in-progress/todo.
// An optional reason is appended as 💬 before the status date.
export async function setTaskState(app: App, path: string, task: Task, state: TaskState, reason?: string): Promise<boolean> {
  const file = app.vault.getFileByPath(path);
  if (!(file instanceof TFile)) return false;
  let ok = false;
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    const raw = lines[task.line];
    const current = raw !== undefined ? parseTaskLine(raw, task.line) : null;
    if (!current || current.text !== task.text) {
      new Notice("Task moved since last index — try again");
      return content;
    }
    lines[task.line] = setStateLine(raw, state, todayISO(), reason);
    ok = true;
    return lines.join("\n");
  });
  return ok;
}
