import { ItemView, WorkspaceLeaf, MarkdownView, setIcon } from "obsidian";
import type GtdFlowPlugin from "./main";
import { runPerspective, PerspectiveItem } from "./perspectives";
import { todayISO } from "./dates";
import { completeTask } from "./completeTask";
import { renderTaskText } from "./linkText";
import { defaultSort, applyManualOrder } from "./ordering";
import { makeReorderable } from "./dragReorder";
import { ensureBlockId } from "./blockId";

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
      root.createDiv({ text: "No perspectives defined — add them in settings.", cls: "gtd-empty" });
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
    const groups = runPerspective(this.plugin.index.allWithInbox(), current, today, this.plugin.settings.flagTag, this.plugin.settings.importantTag);

    if (groups.size === 0) {
      root.createDiv({ text: "Nothing matches this perspective.", cls: "gtd-empty" });
      return;
    }

    const flagTag = this.plugin.settings.flagTag;
    for (const [groupKey, items] of groups) {
      const section = root.createDiv({ cls: "gtd-project" });
      const header = section.createDiv({ cls: "gtd-project-name", text: groupKey });
      if (current.groupBy === "project") {
        const first = items[0];
        if (first) this.plugin.pillFor(header, first.project.path);
      }
      const rowsEl = section.createDiv({ cls: "gtd-day-rows" });
      const orderKey = current.name + " | " + groupKey;
      const ordered = applyManualOrder(
        defaultSort(items, today, flagTag),
        this.plugin.settings.perspectiveOrder[orderKey] ?? []
      );
      const keyToItem = new Map<string, PerspectiveItem>();
      ordered.forEach((it, i) => {
        const k = it.task.blockId ?? `t${i}`;
        keyToItem.set(k, it);
        this.renderItem(rowsEl, it, today, current.groupBy !== "project", k);
      });
      makeReorderable(rowsEl, (keys) => {
        void this.saveGroupOrder(orderKey, keys.map((k) => keyToItem.get(k)).filter((x): x is PerspectiveItem => !!x));
      });
    }
  }

  private async saveGroupOrder(orderKey: string, items: PerspectiveItem[]) {
    const ids: string[] = [];
    for (const it of items) {
      const id = await ensureBlockId(this.app, it.project.path, it.task);
      if (id) ids.push(id);
    }
    this.plugin.settings.perspectiveOrder[orderKey] = ids;
    await this.plugin.persistData();
  }

  private renderItem(parent: HTMLElement, it: PerspectiveItem, today: string, showProject: boolean, key: string) {
    const row = parent.createDiv({ cls: "gtd-task" });
    row.dataset.gtdKey = key;
    const grip = row.createSpan({ cls: "gtd-grip", attr: { "aria-label": "Drag to reorder" } });
    setIcon(grip, "grip-vertical");
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
    this.plugin.importantFor(row, it.task);
    const label = renderTaskText(row, it.task.text, this.app, it.project.path);
    if (it.task.reason) label.createSpan({ cls: "gtd-reason", text: ` 💬 ${it.task.reason}` });
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
    if (showProject) this.plugin.pillFor(row.createSpan({ cls: "gtd-project-ref", text: it.project.name }), it.project.path);
  }
}
