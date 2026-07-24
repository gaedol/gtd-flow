import { MarkdownView, Plugin, TFile, normalizePath, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { GtdSettings, DEFAULT_SETTINGS, GtdSettingTab } from "./settings";
import { TaskIndex } from "./taskIndex";
import { NextActionsView, NEXT_ACTIONS_VIEW } from "./nextActionsView";
import { ForecastView, FORECAST_VIEW } from "./forecastView";
import { ReviewView, REVIEW_VIEW } from "./reviewView";
import { PerspectiveView, PERSPECTIVE_VIEW } from "./perspectiveView";
import { TimelineView, TIMELINE_VIEW } from "./timelineView";
import { archiveDoneTasks } from "./archive";
import { dueOrOverdue, setSomedayTag } from "./engine";
import { insertTaskLine } from "./insertLine";
import { todayISO } from "./dates";
import { parseTaskLine, parseProject } from "./parser";
import type { Task, Project } from "./types";
import { projectNotes, taskContainers } from "./selectors";
import { toggleTagLine, checkboxCharOf } from "./taskWrite";
import { completeTask, setTaskState } from "./completeTask";
import { checkboxClickAction } from "./clickCycle";
import { ReasonModal } from "./reasonModal";
import { registerCommands } from "./commands";
import { registerMenus } from "./menus";
import { registerIntegrations } from "./integrations";
import { explorerStyles, resolveStyle, applyPill } from "./projectColors";
import { statusBlockText, upsertStatusBlock } from "./statusBlock";
import { projectGanttSource } from "./gantt";

export default class GtdFlowPlugin extends Plugin {
  settings!: GtdSettings;
  index!: TaskIndex;
  private notified = new Set<string>(); // keys already notified this day
  private notifyDay = "";

  async onload() {
    await this.loadSettings();
    setSomedayTag(this.settings.somedayTag);
    this.pruneStaleOrders();
    this.addSettingTab(new GtdSettingTab(this.app, this));

    this.index = new TaskIndex(
      this.app,
      () => this.settings.projectsFolder,
      () => normalizePath(this.settings.inboxNote)
    );

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    this.app.workspace.onLayoutReady(() => {
      void this.index.rebuild().then(() => this.notifyDue());
    });
    // re-check periodically while Obsidian is open (dedupe prevents repeats)
    this.registerInterval(window.setInterval(() => this.notifyDue(), 30 * 60 * 1000));
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => this.index.update(file))
    );
    this.registerEvent(
      this.app.vault.on("delete", (f) => this.index.remove(f.path))
    );
    this.registerEvent(
      this.app.vault.on("rename", (f, oldPath) => {
        this.index.remove(oldPath);
        if (f instanceof TFile) void this.index.update(f);
      })
    );

    this.registerView(NEXT_ACTIONS_VIEW, (leaf) => new NextActionsView(leaf, this));
    this.registerView(FORECAST_VIEW, (leaf) => new ForecastView(leaf, this));
    this.registerView(REVIEW_VIEW, (leaf) => new ReviewView(leaf, this));
    this.registerView(PERSPECTIVE_VIEW, (leaf) => new PerspectiveView(leaf, this));
    this.registerView(TIMELINE_VIEW, (leaf) => new TimelineView(leaf, this));

    registerCommands(this);
    registerMenus(this);
    registerIntegrations(this);
  }

  // real project notes only (inbox excluded)
  projectNotes(): Project[] {
    return projectNotes(this.index.snapshot(), this.index.inboxNotePath());
  }

  // projects to search in a done query: the live index, plus archived project
  // notes read on demand (they live outside the indexed projects folder)
  async projectsForQuery(includeArchived: boolean): Promise<Project[]> {
    const projects = this.projectNotes();
    if (!includeArchived) return projects;
    const folder = normalizePath(this.settings.archiveFolder);
    const extra: Project[] = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!f.path.startsWith(folder + "/")) continue;
      if (this.index.get(f.path)) continue; // already indexed
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      const p = parseProject(f.path, await this.app.vault.cachedRead(f), fm);
      if (p) extra.push(p);
    }
    return [...projects, ...extra];
  }

  // a note whose tasks GTD Flow manages: a project note or the configured inbox
  noteInScope(path: string): boolean {
    return !!this.index.get(path) || path === normalizePath(this.settings.inboxNote);
  }

  // decide and perform what a checkbox click does on a source line; returns true
  // when GTD Flow handled it (caller should suppress the default toggle)
  routeCheckbox(path: string, lineNo: number, rawLine: string): boolean {
    const char = checkboxCharOf(rawLine);
    if (char === null) return false;
    const action = checkboxClickAction(char, this.settings.clickCycles);
    if (action === "none") return false;
    const task = parseTaskLine(rawLine, lineNo);
    if (!task) return false;
    if (action === "in-progress") void setTaskState(this.app, path, task, "in-progress");
    else void completeTask(this.app, path, task);
    return true;
  }

  // drop (cancel) a task, prompting for a 💬 reason when that setting is on
  dropTask(path: string, task: Task) {
    if (this.settings.promptDropReason) {
      new ReasonModal(this.app, (reason) => {
        void setTaskState(this.app, path, task, "dropped", reason);
      }).open();
    } else {
      void setTaskState(this.app, path, task, "dropped");
    }
  }

  // toggle the someday tag on a task source line, returning the rewritten line
  toggleSomedayLine(raw: string, tags: string[]): string {
    return this.toggleTagLine(raw, tags, this.settings.somedayTag);
  }

  // add/remove a tag on a task source line, returning the rewritten line
  toggleTagLine(raw: string, tags: string[], tag: string): string {
    return toggleTagLine(raw, tags, tag);
  }

  // star span in views for #important tasks
  importantFor(el: HTMLElement, task: Task) {
    if (!task.tags.includes(this.settings.importantTag)) return;
    const s = el.createSpan({ cls: "gtd-important", attr: { "aria-label": "Important" } });
    setIcon(s, "star");
  }

  applyProjectStyles() {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      const el = view.contentEl;
      const p = view.file ? this.index.get(view.file.path) : undefined;
      const styled = !!(p && (p.color || p.banner));
      el.toggleClass("gtd-project-styled", styled);
      el.setCssProps({ "--gtd-project-color": p?.color ?? "" });
      if (p?.banner) {
        const url = /^https?:\/\//.test(p.banner)
          ? p.banner
          : this.app.vault.adapter.getResourcePath(normalizePath(p.banner));
        el.setCssProps({ "--gtd-project-banner": `url("${url}")` });
      } else {
        el.setCssProps({ "--gtd-project-banner": "" });
      }
    }
  }

  async writeStatusBlock(file: TFile, insertIfMissing: boolean) {
    const project = this.index.get(file.path);
    if (!project) return;
    const today = todayISO();
    let inner = statusBlockText(project, today);
    if (this.settings.statusBlockChart) {
      const chart = projectGanttSource(project, today);
      if (chart) inner += "\n\n```mermaid\n" + chart + "\n```";
    }
    await this.app.vault.process(file, (content) => {
      const r = upsertStatusBlock(content, inner, insertIfMissing);
      return r.changed ? r.content : content; // idempotent: skip write when unchanged
    });
  }

  async convertToProject(file: TFile) {
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm["type"] = "project";
      fm["status"] ??= "active";
      fm["flow"] ??= "parallel";
      fm["review-interval"] ??= this.settings.defaultReviewInterval || null;
      fm["last-reviewed"] ??= null;
    });
    const folder = normalizePath(this.settings.projectsFolder);
    if (!file.path.startsWith(folder + "/")) {
      if (!this.app.vault.getFolderByPath(folder)) await this.app.vault.createFolder(folder);
      await this.app.fileManager.renameFile(file, `${folder}/${file.name}`);
    }
    new Notice(`${file.basename} is now a project`);
  }

  async ensureInboxFile(): Promise<TFile> {
    const path = normalizePath(this.settings.inboxNote);
    let file = this.app.vault.getFileByPath(path);
    if (file) return file;
    const dir = path.replace(/\/[^/]*$/, "");
    if (dir && dir !== path && !this.app.vault.getFolderByPath(dir)) {
      await this.app.vault.createFolder(dir);
    }
    return this.app.vault.create(path, "");
  }

  async appendTaskLine(file: TFile, line: string) {
    await this.app.vault.process(file, (c) =>
      insertTaskLine(c, line, this.settings.insertPosition)
    );
  }

  async archiveNote(file: TFile): Promise<number> {
    let moved = 0;
    await this.app.vault.process(file, (c) => {
      const r = archiveDoneTasks(c, todayISO(), this.settings.archiveAfterDays);
      moved = r.moved;
      return r.content;
    });
    return moved;
  }

  async archiveProject(file: TFile) {
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      if (fm["status"] !== "dropped") fm["status"] = "completed";
    });
    const folder = normalizePath(this.settings.archiveFolder);
    if (!this.app.vault.getFolderByPath(folder)) await this.app.vault.createFolder(folder);
    await this.app.fileManager.renameFile(file, `${folder}/${file.name}`);
    new Notice(`Archived project: ${file.basename}`);
  }

  // native notification for due/overdue tasks; only fires for items not yet
  // announced today, so it nudges once per item rather than every tick
  notifyDue() {
    if (!this.settings.dueNotifications || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const today = todayISO();
    if (today !== this.notifyDay) {
      this.notifyDay = today;
      this.notified.clear();
    }
    const items = dueOrOverdue(taskContainers(this.index.snapshot()), today);
    const fresh = items.filter((i) => !this.notified.has(i.project.path + "::" + i.task.text));
    if (fresh.length === 0) return;
    for (const i of items) this.notified.add(i.project.path + "::" + i.task.text);

    const overdue = items.filter((i) => i.task.due! < today).length;
    const dueToday = items.length - overdue;
    const parts: string[] = [];
    if (overdue) parts.push(`${overdue} overdue`);
    if (dueToday) parts.push(`${dueToday} due today`);
    const n = new Notification("GTD Flow", { body: parts.join(", ") });
    n.onclick = () => this.activateView(FORECAST_VIEW);
  }

  async activateView(type: string) {
    const existing = this.app.workspace.getLeavesOfType(type)[0];
    let leaf: WorkspaceLeaf | null = existing ?? this.app.workspace.getRightLeaf(false);
    if (!existing && leaf) {
      await leaf.setViewState({ type, active: true });
    }
    if (leaf) await this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<GtdSettings>);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    setSomedayTag(this.settings.somedayTag);
    await this.index.rebuild();
  }

  // persist settings (e.g. manual order) without re-indexing
  async persistData() {
    await this.saveData(this.settings);
  }

  // explorer pill for a project path, when enabled and the color plugin is present
  pillFor(el: HTMLElement, path: string) {
    if (!this.settings.explorerColors) return;
    const styles = explorerStyles(this.app);
    if (!styles) return;
    const s = resolveStyle(styles, path);
    if (s) applyPill(el, s);
  }

  // drop saved forecast orders for days already in the past
  pruneStaleOrders() {
    let changed = false;
    // forecast: drop saved orders for days already past
    const today = todayISO();
    const fOrder = this.settings.forecastOrder;
    for (const k of Object.keys(fOrder)) if (k < today) { delete fOrder[k]; changed = true; }
    // perspectives: keys are "name | group"; drop those whose perspective is gone
    const names = new Set(this.settings.perspectives.map((p) => p.name));
    const pOrder = this.settings.perspectiveOrder;
    for (const k of Object.keys(pOrder)) {
      if (!names.has(k.split(" | ")[0])) { delete pOrder[k]; changed = true; }
    }
    if (changed) void this.persistData();
  }
}
