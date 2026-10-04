import { App, Modal, Setting } from "obsidian";
import { Task } from "./types";

export type ArchiveChoice = "drop" | "keep" | "cancel";

// Archiving hides a project from every view, so unfinished tasks in it would
// vanish without a trace. Warn first and let the user decide what happens.
export class ArchiveProjectModal extends Modal {
  private choice: ArchiveChoice = "cancel";

  constructor(
    app: App,
    private projectName: string,
    private openTasks: Task[],
    private onChoice: (c: ArchiveChoice) => void
  ) {
    super(app);
  }

  onOpen() {
    this.setTitle(`${this.projectName} has ${this.openTasks.length} unfinished task(s)`);
    const { contentEl } = this;
    contentEl.createDiv({
      cls: "gtd-archive-warning",
      text: "Archiving removes the project from every GTD Flow view, so these tasks will no longer appear anywhere:",
    });
    const list = contentEl.createEl("ul", { cls: "gtd-archive-list" });
    for (const t of this.openTasks.slice(0, 8)) list.createEl("li", { text: t.text || "(empty task)" });
    if (this.openTasks.length > 8) {
      list.createEl("li", { text: `… and ${this.openTasks.length - 8} more` });
    }

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText("Drop them and archive")
          .setCta()
          .onClick(() => {
            this.choice = "drop";
            this.close();
          })
      )
      .addButton((b) =>
        b.setButtonText("Archive anyway").onClick(() => {
          this.choice = "keep";
          this.close();
        })
      )
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          this.choice = "cancel";
          this.close();
        })
      );
  }

  onClose() {
    this.contentEl.empty();
    this.onChoice(this.choice);
  }
}
