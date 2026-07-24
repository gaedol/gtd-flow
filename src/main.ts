import { MarkdownView, Plugin, TFile, normalizePath, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { GtdSettings, DEFAULT_SETTINGS, GtdSettingTab } from "./settings";
import { TaskIndex } from "./taskIndex";
import { NextActionsView, NEXT_ACTIONS_VIEW } from "./nextActionsView";
import { ForecastView, FORECAST_VIEW } from "./forecastView";
import { ReviewView, REVIEW_VIEW } from "./reviewView";
import { PerspectiveView, PERSPECTIVE_VIEW } from "./perspectiveView";
import { TimelineView, TIMELINE_VIEW } from "./timelineView";
import { CaptureModal } from "./captureModal";
import { gtdEditorDecorations } from "./editorDecorations";
import { TaskSuggest } from "./taskSuggest";
import { archiveDoneTasks } from "./archive";
import { overdueCount, dueOrOverdue, setSomedayTag } from "./engine";
import { insertTaskLine } from "./insertLine";
import { EditTaskModal } from "./editTaskModal";
import { NewProjectModal } from "./newProjectModal";
import { ProjectPropertiesModal } from "./projectPropertiesModal";
import { buildLineClasses } from "./inNote";
import { todayISO } from "./dates";
import { moveTask, ProjectSuggestModal } from "./moveTask";
import { parseTaskLine, parseProject } from "./parser";
import type { Task, Project } from "./types";
import { DoneBlock } from "./doneBlock";
import { DoneReportModal } from "./doneReportModal";
import { projectNotes, taskContainers } from "./selectors";
import { completeTask, setTaskState } from "./completeTask";
import { checkboxClickAction } from "./clickCycle";
import { gtdCheckboxClicks } from "./checkboxClicks";
import { ReasonModal } from "./reasonModal";
import type { Editor } from "obsidian";
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
    const ribbon: [string, string, string, () => void][] = [
      ["list-checks", "GTD: Next actions", "gtd-ribbon-next", () => this.activateView(NEXT_ACTIONS_VIEW)],
      ["calendar-clock", "GTD: Forecast", "gtd-ribbon-forecast", () => this.activateView(FORECAST_VIEW)],
      ["eye", "GTD: Review", "gtd-ribbon-review", () => this.activateView(REVIEW_VIEW)],
      ["telescope", "GTD: Perspectives", "gtd-ribbon-perspectives", () => this.activateView(PERSPECTIVE_VIEW)],
      ["gantt-chart", "GTD: Timeline", "gtd-ribbon-timeline", () => this.activateView(TIMELINE_VIEW)],
      ["plus-circle", "GTD: Capture task", "gtd-ribbon-capture", () => new CaptureModal(this.app, this).open()],
    ];
    for (const [icon, label, cls, fn] of ribbon) {
      this.addRibbonIcon(icon, label, fn).addClass(cls);
    }

    this.addCommand({
      id: "capture-to-inbox",
      name: "Capture task",
      callback: () => new CaptureModal(this.app, this).open(),
    });
    this.addCommand({
      id: "open-review",
      name: "Open review",
      callback: () => this.activateView(REVIEW_VIEW),
    });
    this.addCommand({
      id: "open-next-actions",
      name: "Open next actions",
      callback: () => this.activateView(NEXT_ACTIONS_VIEW),
    });
    this.addCommand({
      id: "open-forecast",
      name: "Open forecast",
      callback: () => this.activateView(FORECAST_VIEW),
    });
    this.addCommand({
      id: "open-perspectives",
      name: "Open perspectives",
      callback: () => this.activateView(PERSPECTIVE_VIEW),
    });
    this.addCommand({
      id: "open-timeline",
      name: "Open timeline",
      callback: () => this.activateView(TIMELINE_VIEW),
    });
    this.addCommand({
      id: "move-task-to-project",
      name: "Move task under cursor to project",
      editorCallback: (editor, view) => {
        const file = view.file;
        if (!file) return;
        const lineNo = editor.getCursor().line;
        const task = parseTaskLine(editor.getLine(lineNo), lineNo);
        if (!task) {
          new Notice("Cursor is not on a task line");
          return;
        }
        new ProjectSuggestModal(this.app, this.projectNotes(), (p) => {
          if (p.path === file.path) return;
          void moveTask(this.app, file.path, task, p.path, this.settings.insertPosition);
        }).open();
      },
    });

    this.addCommand({
      id: "edit-task",
      name: "Edit task under cursor",
      editorCallback: (editor, view) => {
        const file = view.file;
        if (!file) return;
        const lineNo = editor.getCursor().line;
        const task = parseTaskLine(editor.getLine(lineNo), lineNo);
        if (!task) {
          new Notice("Cursor is not on a task line");
          return;
        }
        new EditTaskModal(this.app, this, file.path, task).open();
      },
    });
    this.addCommand({
      id: "project-status-block",
      name: "Insert / update project status block",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.index.get(file.path)) return false;
        if (!checking) void this.writeStatusBlock(file, true);
        return true;
      },
    });
    // refresh an existing status block when its project note is opened
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file && this.index.get(file.path)) void this.writeStatusBlock(file, false);
      })
    );
    this.addCommand({
      id: "drop-task",
      name: "Drop (cancel) task under cursor",
      editorCallback: (editor, view) => {
        const file = view.file;
        if (!file) return;
        const lineNo = editor.getCursor().line;
        const task = parseTaskLine(editor.getLine(lineNo), lineNo);
        if (!task) {
          new Notice("Cursor is not on a task line");
          return;
        }
        this.dropTask(file.path, task);
      },
    });
    this.addCommand({
      id: "toggle-someday",
      name: "Toggle someday on task under cursor",
      editorCallback: (editor) => {
        const lineNo = editor.getCursor().line;
        const raw = editor.getLine(lineNo);
        const task = parseTaskLine(raw, lineNo);
        if (!task) {
          new Notice("Cursor is not on a task line");
          return;
        }
        editor.setLine(lineNo, this.toggleSomedayLine(raw, task.tags));
      },
    });
    this.addCommand({
      id: "toggle-important",
      name: "Toggle important on task under cursor",
      editorCallback: (editor) => {
        const lineNo = editor.getCursor().line;
        const raw = editor.getLine(lineNo);
        const task = parseTaskLine(raw, lineNo);
        if (!task) {
          new Notice("Cursor is not on a task line");
          return;
        }
        editor.setLine(lineNo, this.toggleTagLine(raw, task.tags, this.settings.importantTag));
      },
    });
    this.addCommand({
      id: "export-done-report",
      name: "Export done report",
      callback: () => new DoneReportModal(this.app, this).open(),
    });
    this.addCommand({
      id: "insert-done-query",
      name: "Insert done query block",
      editorCallback: (editor) => {
        editor.replaceSelection("```gtd-done\nrange: last-week\ngroup: project\n```\n");
      },
    });
    this.addCommand({
      id: "new-project",
      name: "New project",
      callback: () => new NewProjectModal(this.app, this).open(),
    });
    this.addCommand({
      id: "convert-to-project",
      name: "Convert current note to project",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || this.index.get(file.path)) return false;
        if (!checking) void this.convertToProject(file);
        return true;
      },
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        const folder = normalizePath(this.settings.projectsFolder);
        if (file instanceof TFile && file.extension === "md" && !this.index.get(file.path)) {
          menu.addItem((i) =>
            i.setTitle("Convert to GTD project").setIcon("list-checks").onClick(() => this.convertToProject(file))
          );
        } else if (!(file instanceof TFile) && (file.path === folder || folder.startsWith(file.path + "/"))) {
          menu.addItem((i) =>
            i.setTitle("New GTD project").setIcon("list-checks").onClick(() => new NewProjectModal(this.app, this).open())
          );
        }
      })
    );
    this.addCommand({
      id: "edit-project-properties",
      name: "Edit project properties",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const project = file ? this.index.get(file.path) : undefined;
        if (!project) return false;
        if (!checking) new ProjectPropertiesModal(this.app, this, project).open();
        return true;
      },
    });
    this.addCommand({
      id: "toggle-project-hold",
      name: "Toggle project on hold / active",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const project = file ? this.index.get(file.path) : undefined;
        if (!file || !project) return false;
        if (!checking) {
          void this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            fm["status"] = fm["status"] === "on-hold" ? "active" : "on-hold";
          });
          new Notice(
            `${project.name}: ${project.status === "on-hold" ? "active" : "on hold"}`
          );
        }
        return true;
      },
    });
    this.addCommand({
      id: "archive-done-tasks",
      name: "Archive done tasks in this note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!this.noteInScope(file.path)) return false;
        if (!checking) void this.archiveNote(file).then((n) => new Notice(`Archived ${n} task(s)`));
        return true;
      },
    });
    this.addCommand({
      id: "archive-done-tasks-all",
      name: "Archive done tasks in all projects",
      callback: async () => {
        let total = 0;
        for (const p of this.projectNotes()) {
          const f = this.app.vault.getFileByPath(p.path);
          if (f) total += await this.archiveNote(f);
        }
        new Notice(`Archived ${total} task(s) across all projects`);
      },
    });
    this.addCommand({
      id: "archive-project",
      name: "Archive current project (complete + move)",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.index.get(file.path)) return false;
        if (!checking) void this.archiveProject(file);
        return true;
      },
    });

    // right-click / long-press menu on a task line in project notes and the inbox
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor: Editor, view) => {
        const file = view.file;
        if (!file || !this.noteInScope(file.path)) return;
        const lineNo = editor.getCursor().line;
        const raw = editor.getLine(lineNo);
        const task = parseTaskLine(raw, lineNo);
        if (!task) return;
        const path = file.path;
        menu.addSeparator();
        menu.addItem((i) =>
          i.setTitle("Edit task").setIcon("pencil").onClick(() => new EditTaskModal(this.app, this, path, task).open())
        );
        if (!task.done) {
          menu.addItem((i) =>
            i.setTitle("Complete task").setIcon("check").onClick(() => void completeTask(this.app, path, task))
          );
          menu.addItem((i) =>
            i.setTitle("Drop task…").setIcon("x-circle").onClick(() => this.dropTask(path, task))
          );
          const isImportant = task.tags.includes(this.settings.importantTag);
          menu.addItem((i) =>
            i
              .setTitle(isImportant ? "Remove important" : "Mark important")
              .setIcon("star")
              .onClick(() =>
                editor.setLine(lineNo, this.toggleTagLine(raw, task.tags, this.settings.importantTag))
              )
          );
          const isSomeday = task.tags.includes(this.settings.somedayTag);
          menu.addItem((i) =>
            i
              .setTitle(isSomeday ? "Remove someday" : "Mark someday")
              .setIcon("clock")
              .onClick(() => editor.setLine(lineNo, this.toggleSomedayLine(raw, task.tags)))
          );
        }
      })
    );

    this.registerMarkdownCodeBlockProcessor("gtd-done", (source, el, ctx) => {
      ctx.addChild(new DoneBlock(el, this, source));
    });

    this.registerEditorSuggest(new TaskSuggest(this.app, this));

    // obsidian://gtd-capture?vault=...&text=...&due=YYYY-MM-DD&defer=YYYY-MM-DD
    this.registerObsidianProtocolHandler("gtd-capture", async (params) => {
      const text = (params.text ?? params.task ?? "").trim();
      if (!text) {
        new CaptureModal(this.app, this).open();
        return;
      }
      let line = `- [ ] ${text}`;
      if (params.defer) line += ` 🛫 ${params.defer}`;
      if (params.due) line += ` 📅 ${params.due}`;
      await this.appendTaskLine(await this.ensureInboxFile(), line);
      new Notice("Captured to inbox: " + text);
    });

    // last + isolated: an editor-extension failure must not take down the plugin
    try {
      this.registerEditorExtension(gtdEditorDecorations(this));
      this.registerEditorExtension(gtdCheckboxClicks(this));
      this.index.on("changed", () => this.app.workspace.updateOptions());
    } catch (e) {
      console.error("GTD Flow: in-note Live Preview decorations disabled", e);
    }
    const statusBar = this.addStatusBarItem();
    statusBar.addClass("gtd-statusbar");
    statusBar.onclick = () => this.activateView(FORECAST_VIEW);
    const updateBadge = () => {
      const n = overdueCount(taskContainers(this.index.snapshot()), todayISO());
      statusBar.setText(n > 0 ? `${n} overdue` : "");
      statusBar.toggleClass("gtd-statusbar-alert", n > 0);
    };
    this.index.on("changed", updateBadge);

    this.index.on("changed", () => this.applyProjectStyles());
    this.registerEvent(this.app.workspace.on("layout-change", () => this.applyProjectStyles()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.applyProjectStyles()));
    this.registerMarkdownPostProcessor((el, ctx) => {
      const project = this.index.get(ctx.sourcePath);
      if (!project) return;
      const info = ctx.getSectionInfo(el);
      if (!info) return;
      const lines = info.text.split("\n");
      const classes = buildLineClasses(project, lines, todayISO());
      const taskLines: number[] = [];
      for (let i = info.lineStart; i <= info.lineEnd; i++) {
        if (classes.has(i) || /^\s*[-*] \[.\] /.test(lines[i] ?? "")) taskLines.push(i);
      }
      const scoped = this.noteInScope(ctx.sourcePath);
      el.querySelectorAll("li.task-list-item").forEach((li, idx) => {
        const srcLine = taskLines[idx];
        const cls = classes.get(srcLine);
        if (cls) li.classList.add(...cls.split(" "));
        // reading-mode completion: route the checkbox through GTD Flow so ✅ +
        // 🔁 recurrence happen, matching the editor/views behaviour
        if (!scoped) return;
        const box = li.querySelector<HTMLInputElement>("input.task-list-item-checkbox");
        const raw = lines[srcLine];
        if (!box || raw === undefined) return;
        this.registerDomEvent(
          box,
          "click",
          (evt) => {
            if (!this.settings.handleEditorClicks) return;
            if (this.routeCheckbox(ctx.sourcePath, srcLine, raw)) {
              evt.preventDefault();
              evt.stopPropagation();
            }
          },
          { capture: true }
        );
      });
    });
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
    const m = rawLine.match(/^\s*[-*] \[(.)\]/);
    if (!m) return false;
    const action = checkboxClickAction(m[1], this.settings.clickCycles);
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
    return tags.includes(tag)
      ? raw.replace(new RegExp(`\\s*#${tag}\\b`), "")
      : raw.replace(/\s*$/, "") + ` #${tag}`;
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
