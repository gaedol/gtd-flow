import { App, EventRef, Modal } from "obsidian";
import type GtdFlowPlugin from "./main";
import { Task } from "./types";
import { inboxTasks } from "./selectors";
import { completeTask } from "./completeTask";
import { EditTaskModal } from "./editTaskModal";
import { renderTaskText } from "./linkText";
import { turnIntoProject, makeReferenceNote, deleteTaskWithPrompt } from "./inboxActions";

interface Action {
  key: string;
  label: string;
  run: (path: string, t: Task) => void;
}

// Walks the inbox one item at a time; each decision is one key. The next item
// appears when the index reports the write, so the view never runs ahead of the note.
export class ProcessInboxModal extends Modal {
  private skipped = new Set<string>();
  private ref: EventRef | null = null;

  constructor(app: App, private plugin: GtdFlowPlugin) {
    super(app);
  }

  private actions(): Action[] {
    const p = this.plugin;
    return [
      { key: "c", label: "Complete", run: (path, t) => void completeTask(this.app, path, t) },
      { key: "m", label: "Move to project", run: (path, t) => p.fileTask(path, t) },
      { key: "e", label: "Edit / defer", run: (path, t) => new EditTaskModal(this.app, p, path, t).open() },
      { key: "w", label: "Waiting for", run: (path, t) => p.markWaiting(path, t, () => p.fileTask(path, t)) },
      { key: "s", label: "Someday", run: (path, t) => p.markSomeday(path, t) },
      { key: "p", label: "Turn into project", run: (path, t) => void turnIntoProject(p, path, t, false) },
      { key: "r", label: "Reference note", run: (path, t) => void makeReferenceNote(p, path, t) },
      { key: "d", label: "Drop", run: (path, t) => p.dropTask(path, t) },
      { key: "x", label: "Delete", run: (path, t) => deleteTaskWithPrompt(p, path, t) },
    ];
  }

  onOpen() {
    this.setTitle("Process inbox");
    this.modalEl.addClass("gtd-process-inbox");
    this.ref = this.plugin.index.on("changed", () => this.render());
    for (const a of this.actions()) {
      this.scope.register([], a.key, () => {
        this.act(a);
        return false;
      });
    }
    for (const key of ["ArrowRight", "n"]) {
      this.scope.register([], key, () => {
        this.skip();
        return false;
      });
    }
    this.render();
  }

  private current(): { path: string; task: Task; left: number } | null {
    const path = this.plugin.index.inboxNotePath();
    const open = inboxTasks(this.plugin.index.snapshot(), path).filter((t) => !this.skipped.has(t.text));
    return open.length ? { path, task: open[0], left: open.length } : null;
  }

  private act(a: Action) {
    const c = this.current();
    if (c) a.run(c.path, c.task);
  }

  private skip() {
    const c = this.current();
    if (!c) return;
    this.skipped.add(c.task.text);
    this.render();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();
    const c = this.current();
    if (!c) {
      contentEl.createDiv({
        cls: "gtd-process-done",
        text: this.skipped.size ? `Done — ${this.skipped.size} skipped item(s) left in the inbox.` : "Inbox empty.",
      });
      return;
    }
    contentEl.createDiv({ cls: "gtd-process-count", text: `${c.left} to process${this.skipped.size ? `, ${this.skipped.size} skipped` : ""}` });
    const item = contentEl.createDiv({ cls: "gtd-process-item" });
    renderTaskText(item, c.task.text, this.app, c.path);
    const meta = [
      c.task.defer && `🛫 ${c.task.defer}`,
      c.task.due && `📅 ${c.task.due}`,
      ...c.task.tags.map((t) => `#${t}`),
    ].filter(Boolean);
    if (meta.length) item.createDiv({ cls: "gtd-process-meta", text: meta.join("  ") });

    const grid = contentEl.createDiv({ cls: "gtd-process-actions" });
    const button = (key: string, label: string, onClick: () => void) => {
      const b = grid.createEl("button");
      b.createEl("kbd", { text: key.toUpperCase() });
      b.createSpan({ text: ` ${label}` });
      b.onclick = onClick;
    };
    for (const a of this.actions()) button(a.key, a.label, () => this.act(a));
    button("→", "Skip", () => this.skip());
  }

  onClose() {
    if (this.ref) this.plugin.index.offref(this.ref);
    this.contentEl.empty();
  }
}
