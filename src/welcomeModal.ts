import { App, Modal, Notice, Setting, normalizePath } from "obsidian";
import type GtdFlowPlugin from "./main";
import { starterFiles } from "./starter";
import { todayISO } from "./dates";
import { NEXT_ACTIONS_VIEW } from "./nextActionsView";
import { ProcessInboxModal } from "./processInboxModal";

// first-run screen: create an example setup, or learn how to use your own notes
export class WelcomeModal extends Modal {
  constructor(app: App, private plugin: GtdFlowPlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Welcome to GTD Flow");
    this.showIntro();
  }

  private showIntro() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      text: "Capture everything into an inbox, decide what each item is, and work from a list of things you can actually do now. Your tasks stay ordinary checklist lines in your own notes.",
    });
    new Setting(contentEl)
      .setName("Start with an example")
      .setDesc("Creates an inbox with three items and two example projects, so you can see how it works. Delete them whenever you like.")
      .addButton((b) => b.setButtonText("Create starter setup").setCta().onClick(() => void this.createStarter()));
    new Setting(contentEl)
      .setName("Use my own notes")
      .setDesc("Point GTD Flow at the notes you already have.")
      .addButton((b) => b.setButtonText("Show me how").onClick(() => this.showOwnNotes()));
    new Setting(contentEl).addButton((b) => b.setButtonText("Skip").onClick(() => this.close()));
  }

  private showOwnNotes() {
    const { contentEl } = this;
    const s = this.plugin.settings;
    contentEl.empty();
    const steps = contentEl.createEl("ol");
    for (const step of [
      `Projects live in "${s.projectsFolder}" and captured tasks go to "${s.inboxNote}". Change either in Settings → GTD Flow.`,
      "Make any note a project: right-click it in the file explorer → Convert to GTD project. It moves into the projects folder.",
      "Write tasks as - [ ] lines. Type at the end of a line for dates, durations and repeats.",
      "Capture with the + in the ribbon, then run Process inbox to decide what each item is.",
      "Work from Next actions; open Review once a week.",
    ]) {
      steps.createEl("li", { text: step });
    }
    contentEl.createEl("p", { text: "The full manual is MANUAL.md in the plugin's repository; it starts with a How do I…? table." });
    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Back").onClick(() => this.showIntro()))
      .addButton((b) =>
        b.setButtonText("Open next actions").setCta().onClick(() => {
          this.close();
          void this.plugin.activateView(NEXT_ACTIONS_VIEW);
        })
      );
  }

  private async createStarter() {
    const s = this.plugin.settings;
    const vault = this.app.vault;
    const files = starterFiles(normalizePath(s.projectsFolder), normalizePath(s.inboxNote), todayISO(), s.defaultReviewInterval);
    let created = 0;
    for (const f of files) {
      if (vault.getAbstractFileByPath(f.path)) continue; // never overwrite
      const dir = f.path.replace(/\/[^/]*$/, "");
      if (dir !== f.path && !vault.getFolderByPath(dir)) await vault.createFolder(dir);
      await vault.create(f.path, f.content);
      created++;
    }
    this.close();
    await this.plugin.activateView(NEXT_ACTIONS_VIEW);
    if (created === 0) {
      new Notice("Starter notes already exist; nothing was overwritten.");
      return;
    }
    new Notice("Starter setup created. Now empty the inbox, one item at a time.");
    window.setTimeout(() => new ProcessInboxModal(this.app, this.plugin).open(), 800);
  }

  onClose() {
    this.contentEl.empty();
  }
}
