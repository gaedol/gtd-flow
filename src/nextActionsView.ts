import { ItemView, Menu, WorkspaceLeaf, setIcon, normalizePath } from "obsidian";
import type GtdFlowPlugin from "./main";
import { availableTasks, dueSoon, waitingFor, WaitingItem } from "./engine";
import { todayISO, daysBetween } from "./dates";
import { completeTask } from "./completeTask";
import { ProcessInboxModal } from "./processInboxModal";
import { turnIntoProject, makeReferenceNote, deleteTaskWithPrompt } from "./inboxActions";
import { EditTaskModal } from "./editTaskModal";
import { renderTaskText } from "./linkText";
import { applySavedOrder } from "./ordering";
import { makeReorderable } from "./dragReorder";
import { projectNotes, inboxTasks, taskContainers } from "./selectors";
import { openTaskLine, renderMarkers, renderDueBadge, renderBlockers } from "./taskRow";
import { stalledState } from "./stalled";
import { Project, Task } from "./types";
import { labelOf } from "./projectLabel";

export const NEXT_ACTIONS_VIEW = "gtd-next-actions";

export class NextActionsView extends ItemView {
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
    this.render();
  }

  private projectNotes() {
    return projectNotes(this.plugin.index.snapshot(), this.plugin.index.inboxNotePath());
  }

  private render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("gtd-next-actions");

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
    this.renderDueSoon(root, today);
    this.renderFlagged(root, projects, today);
    this.renderWaiting(root, today);
    this.renderStalled(root, today);

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
      const nameEl = header.createSpan({ text: labelOf(project) });
      this.plugin.pillFor(nameEl, project.path);
      header.onclick = () => void openTaskLine(this.app, project.path);
      for (const t of tasks) this.renderTask(section, project, t, today);
    }
    if (mode === "manual") {
      makeReorderable(list, (keys) => void this.saveProjectOrder(keys), ".gtd-project");
    }
  }

  private async saveProjectOrder(paths: string[]) {
    // keep only real project paths; stale entries are dropped on each save
    const known = new Set(this.projectNotes().map((p) => p.path));
    this.plugin.settings.projectOrder = paths.filter((p) => known.has(p));
    await this.plugin.persistData();
  }

  private renderInbox(root: HTMLElement) {
    const tasks = inboxTasks(this.plugin.index.snapshot(), this.plugin.index.inboxNotePath());
    if (tasks.length === 0) return;
    const inboxPath = normalizePath(this.plugin.settings.inboxNote);
    const section = root.createDiv({ cls: "gtd-project gtd-inbox" });
    const header = section.createDiv({ cls: "gtd-project-name", text: `Inbox (${tasks.length})` });
    header.onclick = () => void openTaskLine(this.app, inboxPath);
    const process = header.createEl("button", { cls: "gtd-process-btn", text: "Process" });
    process.onclick = (e) => {
      e.stopPropagation();
      new ProcessInboxModal(this.app, this.plugin).open();
    };
    for (const t of tasks) {
      const row = section.createDiv({ cls: "gtd-task" });
      const cb = row.createEl("input", { type: "checkbox" });
      if (t.inProgress) {
        cb.indeterminate = true;
        row.addClass("gtd-inprogress");
      }
      cb.onclick = async () => {
        cb.disabled = true;
        await completeTask(this.app, inboxPath, t);
      };
      renderTaskText(row, t.text, this.app, inboxPath);
      this.editButton(row, inboxPath, t);
      const btn = row.createEl("button", { cls: "gtd-move-btn", attr: { "aria-label": "Move to project" } });
      setIcon(btn, "folder-input");
      btn.onclick = () => this.plugin.fileTask(inboxPath, t);
      const more = row.createEl("button", { cls: "gtd-move-btn", attr: { "aria-label": "Process" } });
      setIcon(more, "more-horizontal");
      more.onclick = (e) => this.processMenu(inboxPath, t).showAtMouseEvent(e);
    }
  }

  // the GTD clarify questions for one inbox item, as a menu
  private processMenu(path: string, t: Task): Menu {
    const plugin = this.plugin;
    const menu = new Menu();
    const item = (title: string, icon: string, run: () => void) =>
      menu.addItem((i) => i.setTitle(title).setIcon(icon).onClick(run));
    item("Complete", "check", () => void completeTask(this.app, path, t));
    item("Move to project…", "folder-input", () => plugin.fileTask(path, t));
    item("Edit / defer…", "pencil", () => new EditTaskModal(this.app, plugin, path, t).open());
    item("Waiting for…", "hourglass", () => plugin.markWaiting(path, t, () => plugin.fileTask(path, t)));
    item("Someday…", "clock", () => plugin.markSomeday(path, t, () => plugin.fileTask(path, t)));
    menu.addSeparator();
    item("Turn into project", "folder-plus", () => void turnIntoProject(plugin, path, t));
    item("Make reference note", "book-open", () => void makeReferenceNote(plugin, path, t));
    menu.addSeparator();
    item("Drop…", "x-circle", () => plugin.dropTask(path, t));
    item("Delete…", "trash-2", () => deleteTaskWithPrompt(plugin, path, t));
    return menu;
  }

  // due today or within the warning window, across every project and the inbox;
  // deferred or waiting tasks are included, since the deadline holds regardless
  private renderDueSoon(root: HTMLElement, today: string) {
    const items = dueSoon(taskContainers(this.plugin.index.snapshot()), today, this.plugin.settings.dueSoonDays);
    if (items.length === 0) return;
    const section = root.createDiv({ cls: "gtd-project gtd-due-soon-section" });
    section.createDiv({ cls: "gtd-project-name", text: `Deadline approaching (${items.length})` });
    for (const { project, task } of items) this.renderTask(section, project, task, today, true);
  }

  // projects with nothing available are filtered out of the list above, which is
  // exactly when they need attention — so name them here
  private renderStalled(root: HTMLElement, today: string) {
    const stalled = this.projectNotes()
      .map((p) => ({ project: p, state: stalledState(p, today) }))
      .filter((s): s is { project: Project; state: NonNullable<ReturnType<typeof stalledState>> } => !!s.state);
    if (stalled.length === 0) return;
    const section = root.createDiv({ cls: "gtd-project gtd-stalled" });
    section.createDiv({ cls: "gtd-project-name", text: `Stalled (${stalled.length})` });
    for (const { project, state } of stalled) {
      const row = section.createDiv({ cls: "gtd-task gtd-stalled-row" });
      const icon = row.createSpan({ cls: "gtd-stalled-icon", attr: { "aria-label": "Stalled" } });
      setIcon(icon, "alert-triangle");
      const name = row.createSpan({ cls: "gtd-task-text", text: labelOf(project) });
      this.plugin.pillFor(name, project.path);
      name.onclick = () => void openTaskLine(this.app, project.path);
      row.createSpan({ cls: "gtd-stalled-reason", text: state.reason });
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
    section.createDiv({ cls: "gtd-project-name", text: `Flagged (${flagged.length})` });
    for (const f of flagged) {
      this.renderTask(section, f.project, f.task, today, true);
    }
  }

  // everything handed to someone else, across projects and the inbox; the wait
  // tag becomes "who · since · follow-up" instead of a chip
  private renderWaiting(root: HTMLElement, today: string) {
    const items = waitingFor(taskContainers(this.plugin.index.snapshot()), today);
    if (items.length === 0) return;
    const section = root.createDiv({ cls: "gtd-project gtd-waiting-section" });
    section.createDiv({ cls: "gtd-project-name", text: `Waiting for (${items.length})` });
    const waitTag = this.plugin.settings.waitTag;
    const isWaitTag = (t: string) => t === waitTag || t.startsWith(waitTag + "/");
    for (const it of items) {
      const row = this.renderTask(section, it.project, it.task, today, true, isWaitTag);
      row.createSpan({ cls: "gtd-waiting-info", text: waitingLabel(it, today) });
      if (it.followUp) {
        row.createSpan({
          cls: "gtd-follow-up" + (it.nudge ? " gtd-nudge" : ""),
          text: it.nudge ? "follow up now" : `follow up ${it.followUp}`,
        });
      }
    }
  }

  private renderTask(
    parent: HTMLElement,
    project: Project,
    task: Task,
    today: string,
    showProject = false,
    hideTag: (tag: string) => boolean = () => false
  ): HTMLElement {
    const row = parent.createDiv({ cls: "gtd-task" });
    const cb = row.createEl("input", { type: "checkbox" });
    if (task.inProgress) {
      cb.indeterminate = true;
      row.addClass("gtd-inprogress");
    }
    cb.onclick = async () => {
      cb.disabled = true;
      await completeTask(this.app, project.path, task);
      // index refresh re-renders via the changed event
    };
    renderMarkers(this.plugin, row, task);
    const label = renderTaskText(row, task.text, this.app, project.path);
    if (task.reason) label.createSpan({ cls: "gtd-reason", text: ` 💬 ${task.reason}` });
    label.onclick = () => void openTaskLine(this.app, project.path, task.line);
    this.editButton(row, project.path, task);
    if (showProject) this.plugin.pillFor(row.createSpan({ cls: "gtd-project-ref", text: labelOf(project) }), project.path);
    renderDueBadge(row, task, today, this.plugin.settings.dueSoonDays);
    renderBlockers(row, task);
    // flag/important already show as icons, so don't repeat them as tag chips
    const iconTags = [this.plugin.settings.flagTag, this.plugin.settings.importantTag];
    for (const tag of task.tags) {
      if (iconTags.includes(tag) || hideTag(tag)) continue;
      row.createSpan({ cls: "gtd-tag", text: "#" + tag });
    }
    return row;
  }

  private editButton(row: HTMLElement, path: string, task: Task) {
    const btn = row.createEl("button", { cls: "gtd-move-btn", attr: { "aria-label": "Edit task" } });
    setIcon(btn, "pencil");
    btn.onclick = () => new EditTaskModal(this.app, this.plugin, path, task).open();
  }

}

function waitingLabel(it: WaitingItem, today: string): string {
  const parts = [it.who ? `waiting on ${it.who}` : "waiting"];
  if (it.since) {
    const n = daysBetween(it.since, today);
    parts.push(n <= 0 ? "since today" : `${n} day${n === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}
