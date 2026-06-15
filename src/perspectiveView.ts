import { ItemView, WorkspaceLeaf, MarkdownView, setIcon } from "obsidian";
import type GtdFlowPlugin from "./main";
import { runPerspective, PerspectiveItem } from "./perspectives";
import { todayISO } from "./dates";
import { completeTask } from "./completeTask";
import { renderTaskText } from "./linkText";

export const PERSPECTIVE_VIEW = "gtd-perspectives";

export class PerspectiveView extends ItemView {
  private selected = "";

  constructor(leaf: WorkspaceLeaf, private plugin: GtdFlowPlugin) {
    super(leaf);
  }

  getViewType() {
    return PERSPECTIVE_VIEW;
  }

  getDisplayText() {
    return "Perspectives";
  }

  getIcon() {
    return "telescope";
  }

  async onOpen() {
    this.registerEvent(this.plugin.index.on("changed", () => this.render()));
    this.render();
  }

  private render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("gtd-perspectives");

    const all = this.plugin.settings.perspectives;
    if (all.length === 0) {
      root.createEl("div", { text: "No perspectives defined — add them in settings.", cls: "gtd-empty" });
      return;
    }
    const current = all.find((p) => p.name === this.selected) ?? all[0];
    this.selected = current.name;

    const select = root.createEl("select", { cls: "dropdown gtd-perspective-select" });
    for (const p of all) {
      const opt = select.createEl("option", { text: p.name, value: p.name });
      if (p.name === current.name) opt.selected = true;
    }
    select.onchange = () => {
      this.selected = select.value;
      this.render();
    };

    const today = todayISO();
    const groups = runPerspective(this.plugin.index.all(), current, today, this.plugin.settings.flagTag);

    if (groups.size === 0) {
      root.createEl("div", { text: "Nothing matches this perspective.", cls: "gtd-empty" });
      return;
    }

    for (const [key, items] of groups) {
      const section = root.createDiv({ cls: "gtd-project" });
      section.createEl("div", { cls: "gtd-project-name", text: key });
      for (const it of items) this.renderItem(section, it, today, current.groupBy !== "project");
    }
  }

  private renderItem(parent: HTMLElement, it: PerspectiveItem, today: string, showProject: boolean) {
    const row = parent.createDiv({ cls: "gtd-task" });
    const cb = row.createEl("input", { type: "checkbox" });
    if (it.task.done) {
      cb.checked = true;
      cb.disabled = true;
      if (it.task.dropped) cb.indeterminate = true; // dropped: shown distinct from completed
    } else {
      if (it.task.inProgress) {
        cb.indeterminate = true;
        row.addClass("gtd-inprogress");
      }
      cb.onclick = async () => {
        cb.disabled = true;
        await completeTask(this.app, it.project.path, it.task);
      };
    }
    if (it.task.tags.includes(this.plugin.settings.flagTag)) {
      const flag = row.createSpan({ cls: "gtd-flag" });
      setIcon(flag, "flag");
    }
    const label = renderTaskText(row, it.task.text, this.app, it.project.path);
    label.onclick = async () => {
      const file = this.app.vault.getFileByPath(it.project.path);
      if (!file) return;
      await this.app.workspace.getLeaf(false).openFile(file);
      this.app.workspace.getActiveViewOfType(MarkdownView)?.editor.setCursor({ line: it.task.line, ch: 0 });
    };
    if (it.task.due) {
      row.createSpan({
        cls: "gtd-due" + (it.task.due < today ? " gtd-overdue" : it.task.due === today ? " gtd-due-today" : ""),
        text: it.task.due,
      });
    }
    if (showProject) row.createSpan({ cls: "gtd-project-ref", text: it.project.name });
  }
}
