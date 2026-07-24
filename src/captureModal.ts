import { App, Modal, Notice, Setting, normalizePath } from "obsidian";
import type GtdFlowPlugin from "./main";
import { projectNotes } from "./selectors";

export class CaptureModal extends Modal {
  private text = "";
  private defer = "";
  private due = "";
  private targetPath: string;

  constructor(app: App, private plugin: GtdFlowPlugin) {
    super(app);
    this.targetPath = normalizePath(plugin.settings.inboxNote);
  }

  onOpen() {
    const { contentEl } = this;
    this.setTitle("Capture task");

    new Setting(contentEl).setName("Task").addText((t) => {
      t.setPlaceholder("What needs doing?").onChange((v) => (this.text = v));
      t.inputEl.addClass("gtd-capture-text");
      t.inputEl.focus();
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void this.submit();
        }
      });
    });

    new Setting(contentEl).setName("Defer until (🛫)").addText((t) => {
      t.inputEl.type = "date";
      t.onChange((v) => (this.defer = v));
    });

    new Setting(contentEl).setName("Due (📅)").addText((t) => {
      t.inputEl.type = "date";
      t.onChange((v) => (this.due = v));
    });

    new Setting(contentEl).setName("Add to").addDropdown((d) => {
      d.addOption(this.targetPath, "Inbox");
      for (const p of projectNotes(this.plugin.index.snapshot(), this.plugin.index.inboxNotePath())) {
        if (p.status === "active") d.addOption(p.path, p.name);
      }
      d.setValue(this.targetPath).onChange((v) => (this.targetPath = v));
    });

    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Capture").setCta().onClick(() => this.submit())
    );
  }

  private async submit() {
    const text = this.text.trim();
    if (!text) {
      new Notice("Task text is empty");
      return;
    }
    let line = `- [ ] ${text}`;
    if (this.defer) line += ` 🛫 ${this.defer}`;
    if (this.due) line += ` 📅 ${this.due}`;

    // only the inbox is auto-created; projects must already exist
    const file =
      this.targetPath === normalizePath(this.plugin.settings.inboxNote)
        ? await this.plugin.ensureInboxFile()
        : this.app.vault.getFileByPath(this.targetPath);
    if (!file) {
      new Notice("Could not open target note");
      return;
    }
    await this.plugin.appendTaskLine(file, line);
    new Notice("Captured: " + text);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
