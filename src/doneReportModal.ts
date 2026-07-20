import { App, Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import type GtdFlowPlugin from "./main";
import {
  DoneGroup,
  collectDone,
  parseDoneQuery,
  rangeLabel,
  renderDoneMarkdown,
  resolveRange,
} from "./doneQuery";
import { todayISO } from "./dates";

const PRESETS: Record<string, string> = {
  "last-week": "Last week",
  "this-week": "This week",
  "last-month": "Last month",
  "this-month": "This month",
  "last-7-days": "Last 7 days",
  "last-30-days": "Last 30 days",
  "this-year": "This year",
  custom: "Custom dates…",
};

// Builds a static "what got closed" note for a period — the shareable snapshot
// counterpart to the live ```gtd-done``` block.
export class DoneReportModal extends Modal {
  private preset = "last-week";
  private from = "";
  private to = "";
  private project = "";
  private group: DoneGroup = "project";
  private includeDropped = false;
  private includeArchived = false;

  constructor(app: App, private plugin: GtdFlowPlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Export done report");
    const { contentEl } = this;

    const dateRows: HTMLElement[] = [];
    const syncDates = () => {
      const show = this.preset === "custom";
      for (const r of dateRows) r.toggleClass("gtd-hidden", !show);
    };

    new Setting(contentEl).setName("Period").addDropdown((d) => {
      for (const [value, label] of Object.entries(PRESETS)) d.addOption(value, label);
      d.setValue(this.preset).onChange((v) => {
        this.preset = v;
        syncDates();
      });
    });

    const fromRow = new Setting(contentEl)
      .setName("From")
      .addText((t) => t.setPlaceholder("YYYY-MM-DD").onChange((v) => (this.from = v.trim())));
    const toRow = new Setting(contentEl)
      .setName("To")
      .addText((t) => t.setPlaceholder("YYYY-MM-DD").onChange((v) => (this.to = v.trim())));
    dateRows.push(fromRow.settingEl, toRow.settingEl);
    syncDates();

    new Setting(contentEl)
      .setName("Project filter")
      .setDesc("Optional: only projects whose name contains this text.")
      .addText((t) => t.setPlaceholder("(all projects)").onChange((v) => (this.project = v.trim())));

    new Setting(contentEl).setName("Group by").addDropdown((d) =>
      d
        .addOption("project", "Project")
        .addOption("day", "Day")
        .addOption("none", "Nothing (flat list)")
        .setValue(this.group)
        .onChange((v) => (this.group = v as DoneGroup))
    );

    new Setting(contentEl)
      .setName("Include dropped tasks")
      .addToggle((t) => t.setValue(false).onChange((v) => (this.includeDropped = v)));
    new Setting(contentEl)
      .setName("Include archived projects")
      .setDesc("Also scan the archive folder, so completed projects still count.")
      .addToggle((t) => t.setValue(false).onChange((v) => (this.includeArchived = v)));

    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Create note").setCta().onClick(() => void this.run())
    );
  }

  private async run() {
    const q = parseDoneQuery(
      [
        this.preset === "custom" ? "" : `range: ${this.preset}`,
        this.preset === "custom" && this.from ? `from: ${this.from}` : "",
        this.preset === "custom" && this.to ? `to: ${this.to}` : "",
        this.project ? `project: ${this.project}` : "",
        `group: ${this.group}`,
        this.includeDropped ? "dropped: true" : "",
        this.includeArchived ? "archived: true" : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
    const range = resolveRange(q, todayISO());
    const projects = await this.plugin.projectsForQuery(q.includeArchived);
    const entries = collectDone(projects, range, q);

    const body = [
      `# Done — ${rangeLabel(range)}`,
      "",
      `_Generated ${todayISO()}${this.project ? ` · project filter: ${this.project}` : ""}_`,
      "",
      renderDoneMarkdown(entries, range, q),
      "",
    ].join("\n");

    const file = await this.writeNote(range.from, range.to, body);
    this.close();
    if (file) {
      new Notice(`Done report: ${entries.length} item(s)`);
      await this.app.workspace.getLeaf(false).openFile(file);
    }
  }

  // written next to the inbox note so reports sit with the rest of the GTD files
  private async writeNote(from: string, to: string, body: string): Promise<TFile | null> {
    const inbox = normalizePath(this.plugin.settings.inboxNote);
    const dir = inbox.includes("/") ? inbox.replace(/\/[^/]*$/, "") : "";
    const base = `Done ${from} to ${to}`;
    if (dir && !this.app.vault.getFolderByPath(dir)) await this.app.vault.createFolder(dir);
    let path = normalizePath(dir ? `${dir}/${base}.md` : `${base}.md`);
    let n = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(dir ? `${dir}/${base} ${n}.md` : `${base} ${n}.md`);
      n++;
    }
    return this.app.vault.create(path, body);
  }

  onClose() {
    this.contentEl.empty();
  }
}
