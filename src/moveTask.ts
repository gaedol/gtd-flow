import { App, FuzzySuggestModal, Notice, TFile } from "obsidian";
import { Project, Task } from "./types";
import { parseTaskLine } from "./parser";
import { insertTaskLine, InsertPosition } from "./insertLine";
import { genBlockId } from "./blockId";
import { triagedLine, withBlockId } from "./taskWrite";

// Append to target first, then remove from source: a duplicate beats a lost task.
// With leaveLink the source line becomes a plain bullet linking to the moved
// task (by block id) instead of being deleted, so it keeps its context.
export async function moveTask(
  app: App,
  fromPath: string,
  task: Task,
  toPath: string,
  pos: InsertPosition = "bottom",
  leaveLink = false
): Promise<boolean> {
  const from = app.vault.getFileByPath(fromPath);
  const to = app.vault.getFileByPath(toPath);
  if (!(from instanceof TFile) || !(to instanceof TFile)) return false;

  const content = await app.vault.read(from);
  const lines = content.split("\n");
  const raw = lines[task.line];
  const current = raw !== undefined ? parseTaskLine(raw, task.line) : null;
  if (!current || current.text !== task.text || current.done !== task.done) {
    new Notice("Task moved since last index — try again");
    return false;
  }

  const id = current.blockId ?? genBlockId();
  const moved = leaveLink ? withBlockId(raw.trim(), id) : raw.trim();
  await app.vault.process(to, (c) => insertTaskLine(c, moved, pos));
  await app.vault.process(from, (c) => {
    const ls = c.split("\n");
    if (ls[task.line] !== raw) {
      new Notice("Source changed during move — check for a duplicate");
      return c;
    }
    if (leaveLink) {
      const link = app.fileManager.generateMarkdownLink(to, fromPath, "#^" + id, to.basename);
      ls[task.line] = triagedLine(raw, current.inlineText ?? current.text, link); // keep the user's #tags
    } else {
      ls.splice(task.line, 1);
    }
    return ls.join("\n");
  });
  return true;
}

export class ProjectSuggestModal extends FuzzySuggestModal<Project> {
  constructor(
    app: App,
    private projects: Project[],
    private onChoose: (p: Project) => void,
    placeholder = "Move task to project…"
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getItems(): Project[] {
    return this.projects
      .filter((p) => p.status === "active" || p.status === "on-hold")
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getItemText(p: Project): string {
    return p.name;
  }

  onChooseItem(p: Project): void {
    this.onChoose(p);
  }
}
