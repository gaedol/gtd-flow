import { Plugin, TFile, normalizePath, Notice, WorkspaceLeaf } from "obsidian";
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
import { buildLineClasses } from "./inNote";
import { todayISO } from "./dates";
import { moveTask, ProjectSuggestModal } from "./moveTask";
import { parseTaskLine } from "./parser";

export default class GtdFlowPlugin extends Plugin {
  settings!: GtdSettings;
  index!: TaskIndex;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new GtdSettingTab(this.app, this));

    this.index = new TaskIndex(
      this.app,
      () => this.settings.projectsFolder,
      () => normalizePath(this.settings.inboxNote)
    );

    this.app.workspace.onLayoutReady(() => this.index.rebuild());
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => this.index.update(file))
    );
    this.registerEvent(
      this.app.vault.on("delete", (f) => this.index.remove(f.path))
    );
    this.registerEvent(
      this.app.vault.on("rename", (f, oldPath) => {
        this.index.remove(oldPath);
        if (f instanceof TFile) this.index.update(f);
      })
    );

    this.registerView(NEXT_ACTIONS_VIEW, (leaf) => new NextActionsView(leaf, this));
    this.registerView(FORECAST_VIEW, (leaf) => new ForecastView(leaf, this));
    this.registerView(REVIEW_VIEW, (leaf) => new ReviewView(leaf, this));
    this.registerView(PERSPECTIVE_VIEW, (leaf) => new PerspectiveView(leaf, this));
    this.registerView(TIMELINE_VIEW, (leaf) => new TimelineView(leaf, this));
    this.addRibbonIcon("list-checks", "GTD: Next actions", () => this.activateView(NEXT_ACTIONS_VIEW));
    this.addRibbonIcon("calendar-clock", "GTD: Forecast", () => this.activateView(FORECAST_VIEW));
    this.addRibbonIcon("eye", "GTD: Review", () => this.activateView(REVIEW_VIEW));
    this.addRibbonIcon("telescope", "GTD: Perspectives", () => this.activateView(PERSPECTIVE_VIEW));
    this.addRibbonIcon("gantt-chart", "GTD: Timeline", () => this.activateView(TIMELINE_VIEW));
    this.addRibbonIcon("plus-circle", "GTD: Capture task", () => new CaptureModal(this.app, this).open());

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
        new ProjectSuggestModal(this.app, this.index.all(), async (p) => {
          if (p.path === file.path) return;
          await moveTask(this.app, file.path, task, p.path);
        }).open();
      },
    });

    this.addCommand({
      id: "archive-done-tasks",
      name: "Archive done tasks in this note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const ok = !!file && (!!this.index.get(file.path) || file.path === normalizePath(this.settings.inboxNote));
        if (ok && !checking) this.archiveNote(file!).then((n) => new Notice(`Archived ${n} task(s)`));
        return ok;
      },
    });
    this.addCommand({
      id: "archive-done-tasks-all",
      name: "Archive done tasks in all projects",
      callback: async () => {
        let total = 0;
        for (const p of this.index.all()) {
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
        const ok = !!file && !!this.index.get(file.path);
        if (ok && !checking) this.archiveProject(file!);
        return ok;
      },
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
      this.index.on("changed", () => this.app.workspace.updateOptions());
    } catch (e) {
      console.error("GTD Flow: in-note Live Preview decorations disabled", e);
    }
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
      el.querySelectorAll("li.task-list-item").forEach((li, idx) => {
        const cls = classes.get(taskLines[idx]);
        if (cls) li.classList.add(...cls.split(" "));
      });
    });
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
    await this.app.vault.process(file, (c) => c.trimEnd() + "\n" + line + "\n");
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
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (fm["status"] !== "dropped") fm["status"] = "completed";
    });
    const folder = normalizePath(this.settings.archiveFolder);
    if (!this.app.vault.getFolderByPath(folder)) await this.app.vault.createFolder(folder);
    await this.app.fileManager.renameFile(file, `${folder}/${file.name}`);
    new Notice(`Archived project: ${file.basename}`);
  }

  async activateView(type: string) {
    const existing = this.app.workspace.getLeavesOfType(type)[0];
    let leaf: WorkspaceLeaf | null = existing ?? this.app.workspace.getRightLeaf(false);
    if (!existing && leaf) {
      await leaf.setViewState({ type, active: true });
    }
    if (leaf) this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    await this.index.rebuild();
  }
}
