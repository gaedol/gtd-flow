import { App, Notice, TFile } from "obsidian";
import { Task } from "./types";
import { parseTaskLine } from "./parser";
import { todayISO } from "./dates";
import { nextOccurrenceLine } from "./repeat";

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
    const today = todayISO();
    lines[task.line] = line.replace("[ ]", "[x]") + ` ✅ ${today}`;
    const next = nextOccurrenceLine(line, today);
    if (next) lines.splice(task.line, 0, next);
    ok = true;
    return lines.join("\n");
  });
  return ok;
}
