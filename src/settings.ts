import { App, PluginSettingTab, Setting } from "obsidian";
import type GtdFlowPlugin from "./main";
import { Perspective, DEFAULT_PERSPECTIVES } from "./perspectives";
import { InsertPosition } from "./insertLine";

export interface GtdSettings {
  projectsFolder: string;
  inboxNote: string;
  forecastDays: number;
  flagTag: string;
  somedayTag: string;
  archiveAfterDays: number;
  archiveFolder: string;
  perspectives: Perspective[];
  dayStart: string;
  dayEnd: string;
  defaultDurationMin: number;
  insertPosition: InsertPosition;
  defaultReviewInterval: string;
  dueNotifications: boolean;
  statusBlockChart: boolean;
}

export const DEFAULT_SETTINGS: GtdSettings = {
  projectsFolder: "GTD/Projects",
  inboxNote: "GTD/Inbox.md",
  forecastDays: 7,
  flagTag: "flag",
  somedayTag: "someday",
  archiveAfterDays: 7,
  archiveFolder: "GTD/Archive",
  perspectives: DEFAULT_PERSPECTIVES,
  dayStart: "09:00",
  dayEnd: "22:00",
  defaultDurationMin: 30,
  insertPosition: "bottom",
  defaultReviewInterval: "1w",
  dueNotifications: true,
  statusBlockChart: false,
};

export class GtdSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: GtdFlowPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Projects folder")
      .setDesc("Folder containing project notes (one note per project).")
      .addText((t) =>
        t.setValue(this.plugin.settings.projectsFolder).onChange(async (v) => {
          this.plugin.settings.projectsFolder = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Inbox note")
      .setDesc("Note where quick-captured tasks are appended.")
      .addText((t) =>
        t.setValue(this.plugin.settings.inboxNote).onChange(async (v) => {
          this.plugin.settings.inboxNote = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Flag tag")
      .setDesc("Tag (without #) marking a task as flagged.")
      .addText((t) =>
        t.setValue(this.plugin.settings.flagTag).onChange(async (v) => {
          this.plugin.settings.flagTag = v.replace(/^#/, "");
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Someday tag")
      .setDesc("Tag (without #) that parks a single task as someday/maybe.")
      .addText((t) =>
        t.setValue(this.plugin.settings.somedayTag).onChange(async (v) => {
          this.plugin.settings.somedayTag = v.replace(/^#/, "") || "someday";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Forecast horizon (days)")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.forecastDays)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n > 0) {
            this.plugin.settings.forecastDays = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Archive tasks done for (days)")
      .setDesc("'Archive done tasks' only moves items completed at least this many days ago (0 = all).")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.archiveAfterDays)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0) {
            this.plugin.settings.archiveAfterDays = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Archive folder")
      .setDesc("Completed project notes are moved here by 'Archive current project'.")
      .addText((t) =>
        t.setValue(this.plugin.settings.archiveFolder).onChange(async (v) => {
          this.plugin.settings.archiveFolder = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Insert captured/moved tasks at")
      .setDesc("Where new task lines land in a project note (always above ## Archive).")
      .addDropdown((d) =>
        d.addOption("bottom", "Bottom of list")
          .addOption("top", "Top of list")
          .setValue(this.plugin.settings.insertPosition)
          .onChange(async (v) => {
            this.plugin.settings.insertPosition = v as InsertPosition;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default review interval")
      .setDesc("Used by 'New project' (e.g. 1w, 3d, 2m; empty = no review).")
      .addText((t) =>
        t.setValue(this.plugin.settings.defaultReviewInterval).onChange(async (v) => {
          this.plugin.settings.defaultReviewInterval = v.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Notify about due tasks")
      .setDesc("System notification for overdue / due-today tasks while Obsidian is open.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.dueNotifications).onChange(async (v) => {
          this.plugin.settings.dueNotifications = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Status block: include timeline")
      .setDesc("Add a per-project Mermaid gantt inside the project status block.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.statusBlockChart).onChange(async (v) => {
          this.plugin.settings.statusBlockChart = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Day starts at")
      .setDesc("Start time for the day timeline (HH:MM).")
      .addText((t) =>
        t.setValue(this.plugin.settings.dayStart).onChange(async (v) => {
          if (/^\d{2}:\d{2}$/.test(v)) {
            this.plugin.settings.dayStart = v;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Day ends at")
      .setDesc("End time for the day timeline (HH:MM).")
      .addText((t) =>
        t.setValue(this.plugin.settings.dayEnd).onChange(async (v) => {
          if (/^\d{2}:\d{2}$/.test(v)) {
            this.plugin.settings.dayEnd = v;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Default task duration (minutes)")
      .setDesc("Used in the day timeline when a task has no ⏱ duration.")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.defaultDurationMin)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n > 0) {
            this.plugin.settings.defaultDurationMin = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl).setName("Perspectives").setHeading();
    this.plugin.settings.perspectives.forEach((p, i) => this.renderPerspective(containerEl, p, i));
    new Setting(containerEl).addButton((b) =>
      b.setButtonText("Add perspective").onClick(async () => {
        this.plugin.settings.perspectives.push({
          name: "New perspective",
          availableOnly: true,
          flagged: false,
          tag: "",
          project: "",
          dueWithin: 0,
          groupBy: "project",
        });
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }

  private renderPerspective(containerEl: HTMLElement, p: Perspective, i: number) {
    const save = async () => this.plugin.saveSettings();
    const row1 = new Setting(containerEl).setClass("gtd-perspective-setting");
    row1
      .addText((t) => t.setPlaceholder("Name").setValue(p.name).onChange(async (v) => { p.name = v; await save(); }))
      .addText((t) => t.setPlaceholder("#tag filter").setValue(p.tag).onChange(async (v) => { p.tag = v.replace(/^#/, ""); await save(); }))
      .addText((t) => t.setPlaceholder("Project filter").setValue(p.project).onChange(async (v) => { p.project = v; await save(); }))
      .addText((t) => {
        t.setPlaceholder("Due ≤ days").setValue(p.dueWithin ? String(p.dueWithin) : "").onChange(async (v) => {
          const n = parseInt(v, 10);
          p.dueWithin = isNaN(n) || n < 0 ? 0 : n;
          await save();
        });
        t.inputEl.addClass("gtd-narrow-input");
      })
      .addDropdown((d) =>
        d.addOption("project", "By project")
          .addOption("tag", "By tag")
          .addOption("due", "By due date")
          .setValue(p.groupBy)
          .onChange(async (v) => { p.groupBy = v as Perspective["groupBy"]; await save(); })
      )
      .addToggle((t) =>
        t.setValue(p.availableOnly).setTooltip("Available tasks only").onChange(async (v) => { p.availableOnly = v; await save(); })
      )
      .addToggle((t) =>
        t.setValue(p.flagged).setTooltip("Flagged only").onChange(async (v) => { p.flagged = v; await save(); })
      )
      .addToggle((t) =>
        t.setValue(p.someday ?? false).setTooltip("Someday projects").onChange(async (v) => { p.someday = v; await save(); })
      )
      .addToggle((t) =>
        t.setValue(p.done ?? false).setTooltip("Completed tasks").onChange(async (v) => { p.done = v; await save(); })
      )
      .addExtraButton((b) =>
        b.setIcon("trash").setTooltip("Delete perspective").onClick(async () => {
          this.plugin.settings.perspectives.splice(i, 1);
          await save();
          this.display();
        })
      );
  }
}
