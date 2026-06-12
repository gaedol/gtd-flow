import { App, Modal, Notice, Setting, normalizePath } from "obsidian";
import type GtdFlowPlugin from "./main";
import { ProjectFlow } from "./types";

export class NewProjectModal extends Modal {
  private name = "";
  private flow: ProjectFlow = "parallel";

  constructor(app: App, private plugin: GtdFlowPlugin) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    this.setTitle("New project");

    new Setting(contentEl).setName("Name").addText((t) => {
      t.setPlaceholder("Renovate kitchen").onChange((v) => (this.name = v));
      t.inputEl.addClass("gtd-capture-text");
      t.inputEl.focus();
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.create();
        }
      });
    });

    new Setting(contentEl).setName("Flow").addDropdown((d) =>
      d.addOption("parallel", "Parallel")
        .addOption("sequential", "Sequential")
        .setValue(this.flow)
        .onChange((v) => (this.flow = v as ProjectFlow))
    );

    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Create").setCta().onClick(() => this.create())
    );
  }

  private async create() {
    const name = this.name.trim().replace(/[\\/:*?"<>|]/g, "-");
    if (!name) {
      new Notice("Project name is empty");
      return;
    }
    const folder = normalizePath(this.plugin.settings.projectsFolder);
    if (!this.app.vault.getFolderByPath(folder)) await this.app.vault.createFolder(folder);
    const path = `${folder}/${name}.md`;
    if (this.app.vault.getFileByPath(path)) {
      new Notice("A project with that name already exists");
      return;
    }
    // all keys present so Obsidian's Properties panel offers them as fields
    const fm = [
      "---",
      "type: project",
      "status: active",
      `flow: ${this.flow}`,
      `review-interval: ${this.plugin.settings.defaultReviewInterval}`,
      "last-reviewed: ",
      "---",
      "",
    ].join("\n");
    const file = await this.app.vault.create(path, fm);
    await this.app.workspace.getLeaf(false).openFile(file);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
