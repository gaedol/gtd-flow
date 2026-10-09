import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type GtdFlowPlugin from "./main";
import { availableTasks } from "./engine";
import { todayISO } from "./dates";
import { completeTask } from "./completeTask";
import { ProjectSuggestModal } from "./moveTask";
import { EditTaskModal } from "./editTaskModal";
import { renderTaskText } from "./linkText";
import { applySavedOrder } from "./ordering";
import { makeReorderable } from "./dragReorder";
import { projectNotes, inboxGroups, noteOf } from "./selectors";
import { isSystemTag } from "./parser";
import { openTaskLine, renderMarkers, renderDueBadge } from "./taskRow";
import { stalledState } from "./stalled";
import { setFolded, sectionKey, projectKey, noteKey } from "./folds";
import { Project, Task } from "./types";

export const NEXT_ACTIONS_VIEW = "gtd-next-actions";

export class NextActionsView extends ItemView {
  private foldKeys: string[] = []; // every foldable header in the current render, for "Collapse all"

  constructor(leaf: WorkspaceLeaf, private plugin: GtdFlowPlugin) {
    super(leaf);
  }

  getViewType() {
    return NEXT_ACTIONS_VIEW;
  }

  getDisplayText() {
    return "Next actions";
  }

  getIcon() {
    return "list-checks";
  }

  async onOpen() {
    this.registerEvent(this.plugin.index.on("changed", () => this.render()));
    this.addAction("chevrons-up-down", "Expand all", () => void this.fold(this.plugin.settings.collapsedNextActions, false));
    this.addAction("chevrons-down-up", "Collapse all", () => void this.fold(this.foldKeys, true));
    this.render();
  }

  private projectNotes() {
    return projectNotes(this.plugin.index.snapshot());
  }

  private render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("gtd-next-actions");
    this.foldKeys = [];

    const today = todayISO();
    const mode = this.plugin.settings.projectSort;
    let projects = this.projectNotes()
      .map((p) => ({ project: p, tasks: availableTasks(p, today) }))
      .filter((g) => g.tasks.length > 0)
      .sort((a, b) =>
        mode === "folder"
          ? a.project.path.localeCompare(b.project.path)
          : a.project.name.localeCompare(b.project.name)
      );
    if (mode === "manual") {
      projects = applySavedOrder(projects, (g) => g.project.path, this.plugin.settings.projectOrder);
    }

    this.renderInbox(root);
    this.renderFlagged(root, projects, today);
    this.renderStalled(root, today);
    this.renderBrokenLinks(root);

    if (projects.length === 0) {
      root.createDiv({ text: "No available tasks.", cls: "gtd-empty" });
      return;
    }

    const list = root.createDiv({ cls: "gtd-projects-list" });
    for (const { project, tasks } of projects) {
      const section = list.createDiv({ cls: "gtd-project" });
      section.dataset.gtdKey = project.path;
      const header = section.createDiv({ cls: "gtd-project-name" });
      if (mode === "manual") {
        const grip = header.createSpan({ cls: "gtd-grip", attr: { "aria-label": "Drag to reorder projects" } });
        setIcon(grip, "grip-vertical");
        grip.addEventListener("click", (e) => e.stopPropagation()); // don't open the note after a drag
      }
      const collapsed = this.foldToggle(header, projectKey(project.path));
      const nameEl = header.createSpan({ text: project.name });
      this.plugin.pillFor(nameEl, project.path);
      header.createSpan({ cls: "gtd-fold-count", text: String(tasks.length) });
      header.onclick = () => void openTaskLine(this.app, project.path);
      if (collapsed) continue;
      for (const t of tasks) this.renderTask(section, project, t, today);
    }
    if (mode === "manual") {
      makeReorderable(list, (keys) => void this.saveProjectOrder(keys), ".gtd-project");
    }
  }

  // a chevron at the start of a header that folds the content under it;
  // returns whether it's folded now
  private foldToggle(header: HTMLElement, key: string): boolean {
    this.foldKeys.push(key);
    const collapsed = this.plugin.settings.collapsedNextActions.includes(key);
    const chevron = header.createSpan({ cls: "gtd-fold-chevron", attr: { "aria-label": collapsed ? "Expand" : "Collapse" } });
    setIcon(chevron, collapsed ? "chevron-right" : "chevron-down");
    chevron.onclick = (e) => {
      e.stopPropagation(); // fold without opening the note
      void this.fold([key], !collapsed);
    };
    return collapsed;
  }

  // a section header (Inbox, Flagged, ...): it opens nothing, so the whole header folds
  private sectionHeader(section: HTMLElement, key: string, text: string): boolean {
    const header = section.createDiv({ cls: "gtd-project-name" });
    const collapsed = this.foldToggle(header, key);
    header.createSpan({ text });
    header.onclick = () => void this.fold([key], !collapsed);
    return collapsed;
  }

  private async fold(keys: string[], fold: boolean) {
    const s = this.plugin.settings;
    s.collapsedNextActions = setFolded(s.collapsedNextActions, keys, fold, (path) => this.plugin.index.has(path));
    this.render();
    await this.plugin.persistData();
  }

  private async saveProjectOrder(paths: string[]) {
    // keep only real project paths; stale entries are dropped on each save
    const known = new Set(this.projectNotes().map((p) => p.path));
    this.plugin.settings.projectOrder = paths.filter((p) => known.has(p));
    await this.plugin.persistData();
  }

  private renderInbox(root: HTMLElement) {
    const vault = this.plugin.settings.inboxScope === "vault";
    const groups = inboxGroups(this.plugin.index.snapshot(), vault, this.plugin.settings.hideSomedayInNextActions);
    const count = groups.reduce((n, g) => n + g.tasks.length, 0);
    if (count === 0) return;
    const section = root.createDiv({ cls: "gtd-project gtd-inbox" });
    if (!vault) {
      // a single inbox note: one flat list, as before
      if (this.sectionHeader(section, sectionKey("inbox"), `Inbox (${count})`)) return;
      for (const t of groups[0].tasks) this.renderInboxTask(section, groups[0].note.path, t);
      return;
    }
    const notes = groups.length === 1 ? "1 note" : `${groups.length} notes`;
    if (this.sectionHeader(section, sectionKey("inbox"), `Inbox (${count} in ${notes})`)) return;
    for (const { note, tasks } of groups) {
      const group = section.createDiv({ cls: "gtd-inbox-note" });
      const header = group.createDiv({ cls: "gtd-inbox-note-name" });
      const collapsed = this.foldToggle(header, noteKey(note.path));
      header.createSpan({ text: note.name });
      header.createSpan({ cls: "gtd-fold-count", text: String(tasks.length) });
      header.onclick = () => void openTaskLine(this.app, note.path);
      if (collapsed) continue;
      for (const t of tasks) this.renderInboxTask(group, note.path, t);
    }
  }

  private renderInboxTask(parent: HTMLElement, path: string, t: Task) {
    const row = parent.createDiv({ cls: "gtd-task" });
    const cb = row.createEl("input", { type: "checkbox" });
    if (t.inProgress) {
      cb.indeterminate = true;
      row.addClass("gtd-inprogress");
    }
    cb.onclick = async () => {
      cb.disabled = true;
      await completeTask(this.app, path, t);
    };
    const label = renderTaskText(row, this.plugin.taskLabel(t), this.app, path);
    label.onclick = () => void openTaskLine(this.app, path, t.line); // jump to it in context
    renderDueBadge(row, t, todayISO()); // e.g. a date inferred from the note's name
    this.editButton(row, path, t);
    const btn = row.createEl("button", { cls: "gtd-move-btn", attr: { "aria-label": "Move to project" } });
    setIcon(btn, "folder-input");
    btn.onclick = () => {
      new ProjectSuggestModal(this.app, this.projectNotes(), (p) => {
        void this.plugin.moveTaskTo(path, t, p.path);
      }).open();
    };
  }

  // projects with nothing available are filtered out of the list above, which is
  // exactly when they need attention — so name them here
  private renderStalled(root: HTMLElement, today: string) {
    const stalled = this.projectNotes()
      .map((p) => ({ project: p, state: stalledState(p, today) }))
      .filter((s): s is { project: Project; state: NonNullable<ReturnType<typeof stalledState>> } => !!s.state);
    if (stalled.length === 0) return;
    const section = root.createDiv({ cls: "gtd-project gtd-stalled" });
    if (this.sectionHeader(section, sectionKey("stalled"), `Stalled (${stalled.length})`)) return;
    for (const { project, state } of stalled) {
      const row = section.createDiv({ cls: "gtd-task gtd-stalled-row" });
      const icon = row.createSpan({ cls: "gtd-stalled-icon", attr: { "aria-label": "Stalled" } });
      setIcon(icon, "alert-triangle");
      const name = row.createSpan({ cls: "gtd-task-text", text: project.name });
      this.plugin.pillFor(name, project.path);
      name.onclick = () => void openTaskLine(this.app, project.path);
      row.createSpan({ cls: "gtd-stalled-reason", text: state.reason });
    }
  }

  // member notes whose `project:` link leads nowhere: their tasks would
  // otherwise silently fall out of the project
  private renderBrokenLinks(root: HTMLElement) {
    const broken = this.plugin.index.brokenLinks();
    if (broken.length === 0) return;
    const section = root.createDiv({ cls: "gtd-project gtd-stalled" });
    if (this.sectionHeader(section, sectionKey("broken"), `Broken project links (${broken.length})`)) return;
    for (const b of broken) {
      const row = section.createDiv({ cls: "gtd-task gtd-stalled-row" });
      const icon = row.createSpan({ cls: "gtd-stalled-icon", attr: { "aria-label": "Broken project link" } });
      setIcon(icon, "unlink");
      const name = row.createSpan({ cls: "gtd-task-text", text: b.name });
      name.onclick = () => void openTaskLine(this.app, b.path);
      row.createSpan({ cls: "gtd-stalled-reason", text: b.reason });
    }
  }

  private renderFlagged(
    root: HTMLElement,
    projects: { project: Project; tasks: Task[] }[],
    today: string
  ) {
    const flagTag = this.plugin.settings.flagTag;
    const flagged = projects.flatMap((g) =>
      g.tasks.filter((t) => t.tags.includes(flagTag)).map((t) => ({ project: g.project, task: t }))
    );
    if (flagged.length === 0) return;
    const section = root.createDiv({ cls: "gtd-project gtd-flagged" });
    if (this.sectionHeader(section, sectionKey("flagged"), `Flagged (${flagged.length})`)) return;
    for (const f of flagged) {
      this.renderTask(section, f.project, f.task, today, true);
    }
  }

  private renderTask(
    parent: HTMLElement,
    project: Project,
    task: Task,
    today: string,
    showProject = false
  ) {
    const row = parent.createDiv({ cls: "gtd-task" });
    const cb = row.createEl("input", { type: "checkbox" });
    if (task.inProgress) {
      cb.indeterminate = true;
      row.addClass("gtd-inprogress");
    }
    const note = noteOf(project, task);
    cb.onclick = async () => {
      cb.disabled = true;
      await completeTask(this.app, note, task);
      // index refresh re-renders via the changed event
    };
    renderMarkers(this.plugin, row, task);
    const label = renderTaskText(row, this.plugin.taskLabel(task), this.app, note);
    if (task.reason) label.createSpan({ cls: "gtd-reason", text: ` 💬 ${task.reason}` });
    label.onclick = () => void openTaskLine(this.app, note, task.line);
    this.editButton(row, note, task);
    if (showProject) this.plugin.pillFor(row.createSpan({ cls: "gtd-project-ref", text: project.name }), project.path);
    renderDueBadge(row, task, today);
    // flag/important already show as icons, so don't repeat them as tag chips;
    // with inline tags the user's own tags are already in the text
    const iconTags = [this.plugin.settings.flagTag, this.plugin.settings.importantTag];
    const inline = this.plugin.settings.inlineTags;
    for (const tag of task.tags) {
      if (iconTags.includes(tag) || (inline && !isSystemTag(tag))) continue;
      row.createSpan({ cls: "gtd-tag", text: "#" + tag });
    }
  }

  private editButton(row: HTMLElement, path: string, task: Task) {
    const btn = row.createEl("button", { cls: "gtd-move-btn", attr: { "aria-label": "Edit task" } });
    setIcon(btn, "pencil");
    btn.onclick = () => new EditTaskModal(this.app, this.plugin, path, task).open();
  }

}
