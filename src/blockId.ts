import { App, TFile } from "obsidian";
import { Task } from "./types";
import { parseTaskLine } from "./parser";

export function genBlockId(): string {
  return "gtd" + Math.random().toString(36).slice(2, 8);
}

// ensure a task line carries a ^block-id, returning it; assigns one if missing
export async function ensureBlockId(app: App, path: string, task: Task): Promise<string | null> {
  if (task.blockId) return task.blockId;
  const file = app.vault.getFileByPath(path);
  if (!(file instanceof TFile)) return null;
  const id = genBlockId();
  let ok = false;
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    const cur = lines[task.line] !== undefined ? parseTaskLine(lines[task.line], task.line) : null;
    if (!cur || cur.text !== task.text || cur.blockId) return content; // moved or already tagged
    lines[task.line] = lines[task.line].replace(/\s*$/, "") + " ^" + id;
    ok = true;
    return lines.join("\n");
  });
  return ok ? id : null;
}
