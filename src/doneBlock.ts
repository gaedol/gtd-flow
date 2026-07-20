import { MarkdownRenderChild, MarkdownView, setIcon } from "obsidian";
import type GtdFlowPlugin from "./main";
import {
  DoneEntry,
  DoneQuery,
  collectDone,
  groupDone,
  parseDoneQuery,
  rangeLabel,
  resolveRange,
} from "./doneQuery";
import { renderTaskText } from "./linkText";
import { todayISO } from "./dates";

// A ```gtd-done``` block: renders the closed items matching its query and
// re-renders whenever the index changes, so the note stays a living log.
export class DoneBlock extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private plugin: GtdFlowPlugin,
    private source: string
  ) {
    super(containerEl);
  }

  onload(): void {
    this.registerEvent(this.plugin.index.on("changed", () => void this.render()));
    void this.render();
  }

  private async render(): Promise<void> {
    const q = parseDoneQuery(this.source);
    const range = resolveRange(q, todayISO());
    const projects = await this.plugin.projectsForQuery(q.includeArchived);
    const entries = collectDone(projects, range, q);

    const root = this.containerEl;
    root.empty();
    root.addClass("gtd-done-block");

    const done = entries.filter((e) => e.state === "done").length;
    const dropped = entries.length - done;
    const header = root.createDiv({ cls: "gtd-done-header" });
    header.createSpan({ cls: "gtd-done-range", text: rangeLabel(range) });
    header.createSpan({
      cls: "gtd-done-count",
      text: dropped ? `${done} done · ${dropped} dropped` : `${done} done`,
    });

    if (entries.length === 0) {
      root.createDiv({ cls: "gtd-empty", text: "Nothing closed in this period." });
      return;
    }

    for (const g of groupDone(entries, q.group)) {
      if (g.label) root.createDiv({ cls: "gtd-done-group", text: g.label });
      const list = root.createDiv({ cls: "gtd-done-list" });
      for (const e of g.entries) this.renderEntry(list, e, q);
    }
  }

  private renderEntry(parent: HTMLElement, e: DoneEntry, q: DoneQuery): void {
    const row = parent.createDiv({ cls: "gtd-done-row" });
    if (e.state === "dropped") row.addClass("gtd-done-dropped");
    const icon = row.createSpan({ cls: "gtd-done-icon" });
    setIcon(icon, e.state === "dropped" ? "x" : "check");
    row.createSpan({ cls: "gtd-done-date", text: e.date });
    const label = renderTaskText(row, e.task.text, this.plugin.app, e.project.path);
    label.onclick = () => void this.openEntry(e);
    if (e.task.reason) label.createSpan({ cls: "gtd-reason", text: ` 💬 ${e.task.reason}` });
    // when grouped by project the heading already says where it came from
    if (q.group !== "project") {
      this.plugin.pillFor(
        row.createSpan({ cls: "gtd-project-ref", text: e.project.name }),
        e.project.path
      );
    }
  }

  private async openEntry(e: DoneEntry): Promise<void> {
    const file = this.plugin.app.vault.getFileByPath(e.project.path);
    if (!file) return;
    const leaf = this.plugin.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    view?.editor.setCursor({ line: e.task.line, ch: 0 });
  }
}
