import { App, Modal, Setting, TFile } from "obsidian";
import type GtdFlowPlugin from "./main";
import { Project, ProjectStatus, ProjectFlow } from "./types";

export class ProjectPropertiesModal extends Modal {
  private status: ProjectStatus;
  private flow: ProjectFlow;
  private reviewInterval: string;
  private lastReviewed: string;
  private color: string;
  private banner: string;

  constructor(app: App, private plugin: GtdFlowPlugin, private project: Project) {
    super(app);
    this.status = project.status;
    this.flow = project.flow;
    this.reviewInterval = project.reviewInterval ?? "";
    this.lastReviewed = project.lastReviewed ?? "";
    this.color = project.color ?? "";
    this.banner = project.banner ?? "";
  }

  onOpen() {
    const { contentEl } = this;
    this.setTitle(`Project: ${this.project.name}`);

    new Setting(contentEl).setName("Status").addDropdown((d) =>
      d.addOption("active", "Active")
        .addOption("on-hold", "On hold")
        .addOption("someday", "Someday")
        .addOption("completed", "Completed")
        .addOption("dropped", "Dropped")
        .setValue(this.status)
        .onChange((v) => (this.status = v as ProjectStatus))
    );

    new Setting(contentEl).setName("Flow").addDropdown((d) =>
      d.addOption("parallel", "Parallel")
        .addOption("sequential", "Sequential")
        .setValue(this.flow)
        .onChange((v) => (this.flow = v as ProjectFlow))
    );

    new Setting(contentEl)
      .setName("Review interval")
      .setDesc("e.g. 1w, 3d, 2m — empty disables review")
      .addText((t) => t.setValue(this.reviewInterval).onChange((v) => (this.reviewInterval = v.trim())));

    new Setting(contentEl).setName("Last reviewed").addText((t) => {
      t.inputEl.type = "date";
      t.setValue(this.lastReviewed).onChange((v) => (this.lastReviewed = v));
    });

    new Setting(contentEl)
      .setName("Page color")
      .setDesc("Tints the project page background.")
      .addColorPicker((c) =>
        c.setValue(this.color || "#888888").onChange((v) => (this.color = v))
      )
      .addExtraButton((b) =>
        b.setIcon("x").setTooltip("No color").onClick(() => {
          this.color = "";
          this.onClose();
          this.onOpen();
        })
      );

    new Setting(contentEl)
      .setName("Banner image")
      .setDesc("Vault path (e.g. assets/kitchen.jpg) or URL; shown as page background.")
      .addText((t) =>
        t.setPlaceholder("assets/img.jpg").setValue(this.banner).onChange((v) => (this.banner = v.trim()))
      );

    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Save").setCta().onClick(() => this.save())
    );
  }

  private async save() {
    const file = this.app.vault.getFileByPath(this.project.path);
    if (!(file instanceof TFile)) return;
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm["type"] = "project";
      fm["status"] = this.status;
      fm["flow"] = this.flow;
      fm["review-interval"] = this.reviewInterval || null;
      fm["last-reviewed"] = this.lastReviewed || null;
      fm["color"] = this.color || null;
      fm["banner"] = this.banner || null;
    });
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
