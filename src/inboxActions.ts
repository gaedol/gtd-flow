import { App, Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import type GtdFlowPlugin from "./main";
import { Task } from "./types";
import { parseTaskLine } from "./parser";
import { cutTaskBlock, noteNameFor, referenceBody } from "./inboxProcess";
import { renderProjectTemplate } from "./projectTemplate";

// Inbox processing actions that turn an item into something else. Each writes the
// new note first and only then removes the item: a duplicate beats a lost task.

// the item's block as it is on disk now, or null if the line moved since indexing
async function readBlock(app: App, path: string, task: Task): Promise<string[] | null> {
  const file = app.vault.getFileByPath(path);
  if (!file) return null;
  const content = await app.vault.read(file);
  const raw = content.split("\n")[task.line];
  const current = raw !== undefined ? parseTaskLine(raw, task.line) : null;
  if (!current || current.text !== task.text) {
    new Notice("Task moved since last index — try again");
    return null;
  }
  return cutTaskBlock(content, task.line)!.block;
}

async function removeBlock(app: App, path: string, task: Task): Promise<void> {
  const file = app.vault.getFileByPath(path);
  if (!(file instanceof TFile)) return;
  await app.vault.process(file, (content) => {
    const current = parseTaskLine(content.split("\n")[task.line] ?? "", task.line);
    if (!current || current.text !== task.text) {
      new Notice("Note changed meanwhile — check for a duplicate");
      return content;
    }
    return cutTaskBlock(content, task.line)!.content;
  });
}

// create `folder/name.md`, adding " 2", " 3"… when the name is taken
async function createNote(app: App, folder: string, name: string, body: string): Promise<TFile> {
  const dir = normalizePath(folder);
  if (!app.vault.getFolderByPath(dir)) await app.vault.createFolder(dir);
  let path = `${dir}/${name}.md`;
  for (let n = 2; app.vault.getAbstractFileByPath(path); n++) path = `${dir}/${name} ${n}.md`;
  return app.vault.create(path, body);
}

export async function turnIntoProject(plugin: GtdFlowPlugin, path: string, task: Task, open = true): Promise<void> {
  const app = plugin.app;
  const block = await readBlock(app, path, task);
  const name = noteNameFor(task.text);
  if (!block || !name) return;
  const body = renderProjectTemplate(plugin.settings.projectTemplate, block, plugin.settings.defaultReviewInterval);
  const file = await createNote(app, plugin.settings.projectsFolder, name, body);
  await removeBlock(app, path, task);
  if (open) await app.workspace.getLeaf(false).openFile(file);
  else new Notice(`Created project ${file.basename}`);
}

export async function makeReferenceNote(plugin: GtdFlowPlugin, path: string, task: Task): Promise<void> {
  const app = plugin.app;
  const block = await readBlock(app, path, task);
  const name = noteNameFor(task.text);
  if (!block || !name) return;
  const file = await createNote(app, plugin.settings.referenceFolder, name, referenceBody(block));
  await removeBlock(app, path, task);
  new Notice(`Filed as ${file.basename}`);
}

// asks first: from a view there's no editor undo
export function deleteTaskWithPrompt(plugin: GtdFlowPlugin, path: string, task: Task): void {
  new ConfirmDeleteModal(plugin.app, task.text, () => void removeBlock(plugin.app, path, task)).open();
}

class ConfirmDeleteModal extends Modal {
  constructor(app: App, private text: string, private onConfirm: () => void) {
    super(app);
  }

  onOpen() {
    this.setTitle("Delete task?");
    this.scope.register([], "Enter", () => {
      this.close();
      this.onConfirm();
      return false;
    });
    this.contentEl.createEl("p", { text: this.text });
    this.contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "The line is removed, with any subtasks and notes under it. To keep a record, drop it instead. Enter deletes, Esc cancels.",
    });
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText("Delete").setWarning().onClick(() => {
          this.close();
          this.onConfirm();
        })
      )
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }
}
