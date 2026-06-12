import { ItemView, WorkspaceLeaf, MarkdownRenderer } from "obsidian";
import type GtdFlowPlugin from "./main";
import { ganttSource, TimelineMode } from "./gantt";
import { todayISO } from "./dates";

export const TIMELINE_VIEW = "gtd-timeline";

export class TimelineView extends ItemView {
  private mode: TimelineMode = "week";

  constructor(leaf: WorkspaceLeaf, private plugin: GtdFlowPlugin) {
    super(leaf);
  }

  getViewType() {
    return TIMELINE_VIEW;
  }

  getDisplayText() {
    return "Timeline";
  }

  getIcon() {
    return "gantt-chart";
  }

  async onOpen() {
    this.registerEvent(this.plugin.index.on("changed", () => this.render()));
    await this.render();
  }

  private async render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("gtd-timeline");

    const bar = root.createDiv({ cls: "gtd-timeline-bar" });
    for (const m of ["day", "week", "month"] as TimelineMode[]) {
      const btn = bar.createEl("button", {
        text: m[0].toUpperCase() + m.slice(1),
        cls: "gtd-timeline-mode" + (m === this.mode ? " gtd-timeline-active" : ""),
      });
      btn.onclick = () => {
        this.mode = m;
        this.render();
      };
    }

    const src = ganttSource(this.plugin.index.all(), this.mode, todayISO(), {
      dayStart: this.plugin.settings.dayStart,
      dayEnd: this.plugin.settings.dayEnd,
      defaultDurationMin: this.plugin.settings.defaultDurationMin,
    });
    const body = root.createDiv();
    if (!src) {
      body.createEl("div", { text: "Nothing to chart for this range.", cls: "gtd-empty" });
      return;
    }
    await MarkdownRenderer.render(this.app, "```mermaid\n" + src + "\n```", body, "", this);
  }
}
