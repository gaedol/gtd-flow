import { App, PluginSettingTab, Setting, SettingDefinitionItem, SettingGroupItem } from "obsidian";
import type GtdFlowPlugin from "./main";
import { Perspective, DEFAULT_PERSPECTIVES } from "./perspectives";
import { InsertPosition } from "./insertLine";
import { explorerStyles } from "./projectColors";

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
  promptDropReason: boolean;
  explorerColors: boolean;
  handleEditorClicks: boolean;
  clickCycles: boolean;
  projectSort: "alpha" | "folder" | "manual";
  projectOrder: string[]; // project paths in manual order
  forecastOrder: Record<string, string[]>; // dateKey -> block ids in manual order
  perspectiveOrder: Record<string, string[]>; // perspective+group key -> block ids
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
  promptDropReason: true,
  explorerColors: true,
  handleEditorClicks: true,
  clickCycles: false,
  projectSort: "alpha",
  projectOrder: [],
  forecastOrder: {},
  perspectiveOrder: {},
};

export class GtdSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: GtdFlowPlugin) {
    super(app, plugin);
  }

  // declarative settings (Obsidian 1.13+: rendered instead of display(),
  // and indexed by the global settings search); display() below remains the
  // fallback for older versions
  getSettingDefinitions(): SettingDefinitionItem[] {
    const p = this.plugin;
    return [
      { name: "Projects folder", desc: "Folder containing project notes (one note per project).", control: { type: "folder", key: "projectsFolder" } },
      { name: "Inbox note", desc: "Note where quick-captured tasks are appended.", control: { type: "file", key: "inboxNote" } },
      { name: "Flag tag", desc: "Tag (without #) marking a task as flagged.", control: { type: "text", key: "flagTag" } },
      { name: "Someday tag", desc: "Tag (without #) that parks a single task as someday/maybe.", control: { type: "text", key: "somedayTag" } },
      {
        name: "Match file-explorer colors",
        desc: "Color project names in GTD views using your 'Color Folders and Files' styles.",
        visible: () => !!explorerStyles(this.app),
        control: { type: "toggle", key: "explorerColors" },
      },
      { name: "Ask for a reason when dropping a task", desc: "The 'Drop (cancel) task' command prompts for a 💬 reason.", control: { type: "toggle", key: "promptDropReason" } },
      { name: "Handle checkbox clicks in notes", desc: "Completing a task by clicking its checkbox in a project note writes ✅ and the 🔁 next occurrence (like the GTD views).", control: { type: "toggle", key: "handleEditorClicks" } },
      { name: "Click cycles to-do → in-progress → done", desc: "With this on, the first checkbox click marks a task in-progress [/]; the next completes it. Requires checkbox handling above.", control: { type: "toggle", key: "clickCycles" } },
      { name: "Notify about due tasks", desc: "System notification for overdue / due-today tasks while Obsidian is open.", control: { type: "toggle", key: "dueNotifications" } },
      { name: "Status block: include timeline", desc: "Add a per-project Mermaid gantt inside the project status block.", control: { type: "toggle", key: "statusBlockChart" } },
      {
        name: "Insert captured/moved tasks at",
        desc: "Where new task lines land in a project note (always above ## Archive).",
        control: { type: "dropdown", key: "insertPosition", options: { bottom: "Bottom of list", top: "Top of list" } },
      },
      {
        name: "Sort projects in Next Actions",
        desc: "Manual shows drag handles on the project headers.",
        control: { type: "dropdown", key: "projectSort", options: { alpha: "Alphabetical", folder: "By folder (explorer-like)", manual: "Manual (drag)" } },
      },
      { name: "Default review interval", desc: "Used by 'New project' (e.g. 1w, 3d, 2m; empty = no review).", control: { type: "text", key: "defaultReviewInterval" } },
      { name: "Forecast horizon (days)", control: { type: "number", key: "forecastDays", min: 1 } },
      { name: "Archive tasks done for (days)", desc: "'Archive done tasks' only moves items completed at least this many days ago (0 = all).", control: { type: "number", key: "archiveAfterDays", min: 0 } },
      { name: "Archive folder", desc: "Completed project notes are moved here by 'Archive current project'.", control: { type: "folder", key: "archiveFolder" } },
      { name: "Day starts at", desc: "Start time for the day timeline (HH:MM).", control: { type: "text", key: "dayStart", placeholder: "09:00" } },
      { name: "Day ends at", desc: "End time for the day timeline (HH:MM).", control: { type: "text", key: "dayEnd", placeholder: "22:00" } },
      { name: "Default task duration (minutes)", desc: "Used in the day timeline when a task has no ⏱ duration.", control: { type: "number", key: "defaultDurationMin", min: 1 } },
      {
        type: "group",
        heading: "Perspectives",
        items: [
          ...p.settings.perspectives.map((persp, i): SettingGroupItem => ({
            name: persp.name || "(unnamed perspective)",
            searchable: false,
            render: (setting: Setting) => this.configurePerspective(setting, persp, i),
          })),
          {
            name: "Add perspective",
            action: () => {
              p.settings.perspectives.push({
                name: "New perspective", availableOnly: true, flagged: false,
                tag: "", project: "", dueWithin: 0, groupBy: "project",
              });
              void p.saveSettings().then(() => this.refresh());
            },
          },
        ],
      },
    ];
  }

  // route declarative control writes through saveSettings so side effects
  // (someday-tag refresh, index rebuild) still run; normalize tag inputs
  async setControlValue(key: string, value: unknown): Promise<void> {
    const s = this.plugin.settings as unknown as Record<string, unknown>;
    if ((key === "flagTag" || key === "somedayTag") && typeof value === "string") {
      value = value.replace(/^#/, "") || (key === "somedayTag" ? "someday" : "flag");
    }
    if ((key === "dayStart" || key === "dayEnd") && typeof value === "string" && !/^\d{2}:\d{2}$/.test(value)) {
      return; // ignore invalid times, keep previous value
    }
    s[key] = value;
    await this.plugin.saveSettings();
  }

  // re-render whichever settings surface is active (1.13 definitions or display)
  private refresh(): void {
    const update = (this as Partial<{ update: () => void }>).update;
    if (typeof update === "function") update.call(this);
    else this.display();
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
      .setName("Sort projects in Next Actions")
      .setDesc("Manual shows drag handles on the project headers.")
      .addDropdown((d) =>
        d.addOption("alpha", "Alphabetical")
          .addOption("folder", "By folder (explorer-like)")
          .addOption("manual", "Manual (drag)")
          .setValue(this.plugin.settings.projectSort)
          .onChange(async (v) => {
            this.plugin.settings.projectSort = v as GtdSettings["projectSort"];
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

    if (explorerStyles(this.app)) {
      new Setting(containerEl)
        .setName("Match file-explorer colors")
        .setDesc("Color project names in GTD views using your 'Color Folders and Files' styles.")
        .addToggle((t) =>
          t.setValue(this.plugin.settings.explorerColors).onChange(async (v) => {
            this.plugin.settings.explorerColors = v;
            await this.plugin.saveSettings();
          })
        );
    }

    new Setting(containerEl)
      .setName("Ask for a reason when dropping a task")
      .setDesc("The 'Drop (cancel) task' command prompts for a 💬 reason (Enter/Esc to skip).")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.promptDropReason).onChange(async (v) => {
          this.plugin.settings.promptDropReason = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Handle checkbox clicks in notes")
      .setDesc("Completing a task by clicking its checkbox in a project note writes ✅ and the 🔁 next occurrence (like the GTD views).")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.handleEditorClicks).onChange(async (v) => {
          this.plugin.settings.handleEditorClicks = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Click cycles to-do → in-progress → done")
      .setDesc("With this on, the first checkbox click marks a task in-progress [/]; the next completes it. Requires checkbox handling above.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.clickCycles).onChange(async (v) => {
          this.plugin.settings.clickCycles = v;
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
        this.refresh();
      })
    );
  }

  private renderPerspective(containerEl: HTMLElement, p: Perspective, i: number) {
    const s = new Setting(containerEl);
    this.configurePerspective(s, p, i);
  }

  // configures one perspective's editing row; shared by display() and the
  // declarative render definitions
  private configurePerspective(s: Setting, p: Perspective, i: number) {
    const save = async () => this.plugin.saveSettings();
    s.setClass("gtd-perspective-setting");
    s.addText((t) => t.setPlaceholder("Name").setValue(p.name).onChange(async (v) => { p.name = v; await save(); }));
    s.addText((t) => t.setPlaceholder("#tag filter").setValue(p.tag).onChange(async (v) => { p.tag = v.replace(/^#/, ""); await save(); }));
    s.addText((t) => t.setPlaceholder("Project filter").setValue(p.project).onChange(async (v) => { p.project = v; await save(); }));
    s.addText((t) => {
      t.setPlaceholder("Due ≤ days").setValue(p.dueWithin ? String(p.dueWithin) : "").onChange(async (v) => {
        const n = parseInt(v, 10);
        p.dueWithin = isNaN(n) || n < 0 ? 0 : n;
        await save();
      });
      t.inputEl.addClass("gtd-narrow-input");
    });
    s.addDropdown((d) =>
      d.addOption("project", "By project").addOption("tag", "By tag").addOption("due", "By due date")
        .setValue(p.groupBy).onChange(async (v) => { p.groupBy = v as Perspective["groupBy"]; await save(); })
    );
    // labeled toggles (the label span is appended just before each toggle)
    const toggle = (text: string, get: () => boolean, set: (v: boolean) => void) => {
      s.controlEl.createSpan({ cls: "gtd-toggle-label", text });
      s.addToggle((t) => t.setValue(get()).onChange(async (v) => { set(v); await save(); }));
    };
    toggle("avail", () => p.availableOnly, (v) => (p.availableOnly = v));
    toggle("flag", () => p.flagged, (v) => (p.flagged = v));
    toggle("someday", () => p.someday ?? false, (v) => (p.someday = v));
    toggle("done", () => p.done ?? false, (v) => (p.done = v));
    s.addExtraButton((b) =>
      b.setIcon("trash").setTooltip("Delete perspective").onClick(async () => {
        this.plugin.settings.perspectives.splice(i, 1);
        await save();
        this.refresh();
      })
    );
  }
}
