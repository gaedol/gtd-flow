import { App, Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import type GtdFlowPlugin from "./main";

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
          this.submit();
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
      for (const p of this.plugin.index.all()) {
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

    const file = await this.ensureFile(this.targetPath);
    if (!file) {
      new Notice("Could not open target note");
      return;
    }
    await this.app.vault.process(file, (c) => c.trimEnd() + "\n" + line + "\n");
    new Notice("Captured: " + text);
    this.close();
  }

  // only the inbox is auto-created; projects must already exist
  private async ensureFile(path: string): Promise<TFile | null> {
    let file = this.app.vault.getFileByPath(path);
    if (file) return file;
    if (path !== normalizePath(this.plugin.settings.inboxNote)) return null;
    const dir = path.replace(/\/[^/]*$/, "");
    if (dir && dir !== path && !this.app.vault.getFolderByPath(dir)) {
      await this.app.vault.createFolder(dir);
    }
    return this.app.vault.create(path, "");
  }

  onClose() {
    this.contentEl.empty();
  }
}
