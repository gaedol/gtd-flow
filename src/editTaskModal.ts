import { App, Modal, Notice, Setting, TFile } from "obsidian";
import type GtdFlowPlugin from "./main";
import { Task } from "./types";
import { parseTaskLine } from "./parser";
import { serializeTask, formatDuration, parseDuration } from "./serialize";

export class EditTaskModal extends Modal {
  private text: string;
  private defer: string;
  private due: string;
  private duration: string;
  private repeat: string;
  private flagged: boolean;

  constructor(
    app: App,
    private plugin: GtdFlowPlugin,
    private path: string,
    private task: Task
  ) {
    super(app);
    const flagTag = plugin.settings.flagTag;
    this.text = task.text;
    this.defer = task.defer ?? "";
    this.due = task.due ?? "";
    this.duration = task.durationMin ? formatDuration(task.durationMin) : "";
    this.repeat = task.repeat ?? "";
    this.flagged = task.tags.includes(flagTag);
  }

  onOpen() {
    const { contentEl } = this;
    this.setTitle("Edit task");

    new Setting(contentEl).setName("Task").addText((t) => {
      t.setValue(this.text).onChange((v) => (this.text = v));
      t.inputEl.addClass("gtd-capture-text");
    });
    new Setting(contentEl).setName("Defer until (🛫)").addText((t) => {
      t.inputEl.type = "date";
      t.setValue(this.defer).onChange((v) => (this.defer = v));
    });
    new Setting(contentEl).setName("Due (📅)").addText((t) => {
      t.inputEl.type = "date";
      t.setValue(this.due).onChange((v) => (this.due = v));
    });
    new Setting(contentEl).setName("Duration (⏱)").addText((t) =>
      t.setPlaceholder("1h30m").setValue(this.duration).onChange((v) => (this.duration = v))
    );
    new Setting(contentEl).setName("Repeat (🔁)").addText((t) =>
      t.setPlaceholder("every week").setValue(this.repeat).onChange((v) => (this.repeat = v))
    );
    new Setting(contentEl).setName("Flagged").addToggle((t) =>
      t.setValue(this.flagged).onChange((v) => (this.flagged = v))
    );
    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Save").setCta().onClick(() => this.save())
    );
  }

  private async save() {
    const text = this.text.trim();
    if (!text) {
      new Notice("Task text is empty");
      return;
    }
    if (this.duration.trim() && parseDuration(this.duration) === undefined) {
      new Notice("Duration must look like 30m, 2h or 1h30m");
      return;
    }
    const flagTag = this.plugin.settings.flagTag;
    const tags = this.task.tags.filter((t) => t !== flagTag);
    if (this.flagged) tags.push(flagTag);

    const newLine = serializeTask({
      indent: this.task.indent,
      done: this.task.done,
      completedOn: this.task.completedOn,
      text,
      tags,
      repeat: this.repeat.trim() || undefined,
      defer: this.defer || undefined,
      due: this.due || undefined,
      durationMin: this.duration.trim() ? parseDuration(this.duration) : undefined,
    });

    const file = this.app.vault.getFileByPath(this.path);
    if (!(file instanceof TFile)) return;
    let ok = false;
    await this.app.vault.process(file, (content) => {
      const lines = content.split("\n");
      const current =
        lines[this.task.line] !== undefined
          ? parseTaskLine(lines[this.task.line], this.task.line)
          : null;
      if (!current || current.text !== this.task.text || current.done !== this.task.done) {
        new Notice("Task moved since last index — try again");
        return content;
      }
      lines[this.task.line] = newLine;
      ok = true;
      return lines.join("\n");
    });
    if (ok) this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
