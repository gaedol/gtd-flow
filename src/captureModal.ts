import { App, Modal, Notice, Setting } from "obsidian";
import type GtdFlowPlugin from "./main";
import { projectNotes } from "./selectors";

// target value for the default capture note (daily note or inbox); its path
// is only resolved on submit, since the daily note may not exist yet
const CAPTURE_TARGET = "";

export class CaptureModal extends Modal {
  private text = "";
  private defer = "";
  private due = "";
  private targetPath = CAPTURE_TARGET;

  constructor(app: App, private plugin: GtdFlowPlugin) {
    super(app);
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
      d.addOption(CAPTURE_TARGET, this.plugin.captureLabel());
      for (const p of projectNotes(this.plugin.index.snapshot())) {
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

    // only the capture note is auto-created; projects must already exist
    const file =
      this.targetPath === CAPTURE_TARGET
        ? await this.plugin.ensureCaptureFile()
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
