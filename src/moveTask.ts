import { App, FuzzySuggestModal, Notice, TFile } from "obsidian";
import { Project, Task } from "./types";
import { parseTaskLine } from "./parser";

// Append to target first, then remove from source: a duplicate beats a lost task
export async function moveTask(
  app: App,
  fromPath: string,
  task: Task,
  toPath: string
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

  await app.vault.process(to, (c) => c.trimEnd() + "\n" + raw.trim() + "\n");
  await app.vault.process(from, (c) => {
    const ls = c.split("\n");
    if (ls[task.line] !== raw) {
      new Notice("Source changed during move — check for a duplicate");
      return c;
    }
    ls.splice(task.line, 1);
    return ls.join("\n");
  });
  return true;
}

export class ProjectSuggestModal extends FuzzySuggestModal<Project> {
  constructor(app: App, private projects: Project[], private onChoose: (p: Project) => void) {
    super(app);
    this.setPlaceholder("Move task to project…");
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
