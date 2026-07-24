import { ItemView, WorkspaceLeaf, setIcon, normalizePath } from "obsidian";
import type GtdFlowPlugin from "./main";
import { availableTasks } from "./engine";
import { todayISO } from "./dates";
import { completeTask } from "./completeTask";
import { moveTask, ProjectSuggestModal } from "./moveTask";
import { EditTaskModal } from "./editTaskModal";
import { renderTaskText } from "./linkText";
import { applySavedOrder } from "./ordering";
import { makeReorderable } from "./dragReorder";
import { projectNotes, inboxTasks } from "./selectors";
import { openTaskLine, renderMarkers, renderDueBadge } from "./taskRow";
import { Project, Task } from "./types";

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
    this.renderFlagged(root, projects, today);

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
      const nameEl = header.createSpan({ text: project.name });
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
    section.createDiv({ cls: "gtd-project-name", text: `Inbox (${tasks.length})` });
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
      btn.onclick = () => {
        new ProjectSuggestModal(this.app, this.projectNotes(), (p) => {
          void moveTask(this.app, inboxPath, t, p.path, this.plugin.settings.insertPosition);
        }).open();
      };
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
    if (showProject) this.plugin.pillFor(row.createSpan({ cls: "gtd-project-ref", text: project.name }), project.path);
    renderDueBadge(row, task, today);
    // flag/important already show as icons, so don't repeat them as tag chips
    const iconTags = [this.plugin.settings.flagTag, this.plugin.settings.importantTag];
    for (const tag of task.tags) {
      if (iconTags.includes(tag)) continue;
      row.createSpan({ cls: "gtd-tag", text: "#" + tag });
    }
  }

  private editButton(row: HTMLElement, path: string, task: Task) {
    const btn = row.createEl("button", { cls: "gtd-move-btn", attr: { "aria-label": "Edit task" } });
    setIcon(btn, "pencil");
    btn.onclick = () => new EditTaskModal(this.app, this.plugin, path, task).open();
  }

}
