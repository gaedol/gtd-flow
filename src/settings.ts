import { App, PluginSettingTab, Setting } from "obsidian";
import type GtdFlowPlugin from "./main";

export interface GtdSettings {
  projectsFolder: string;
  inboxNote: string;
  forecastDays: number;
  flagTag: string;
  archiveAfterDays: number;
  archiveFolder: string;
}

export const DEFAULT_SETTINGS: GtdSettings = {
  projectsFolder: "GTD/Projects",
  inboxNote: "GTD/Inbox.md",
  forecastDays: 7,
  flagTag: "flag",
  archiveAfterDays: 7,
  archiveFolder: "GTD/Archive",
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
  }
}
