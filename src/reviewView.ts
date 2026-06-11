import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type GtdFlowPlugin from "./main";
import { isDueForReview, addInterval, availableTasks } from "./engine";
import { todayISO } from "./dates";
import { Project } from "./types";

export const REVIEW_VIEW = "gtd-review";

export class ReviewView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: GtdFlowPlugin) {
    super(leaf);
  }

  getViewType() {
    return REVIEW_VIEW;
  }

  getDisplayText() {
    return "Review";
  }

  getIcon() {
    return "eye";
  }

  async onOpen() {
    this.registerEvent(this.plugin.index.on("changed", () => this.render()));
    this.render();
  }

  private render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("gtd-review");

    const today = todayISO();
    const due = this.plugin.index
      .all()
      .filter((p) => isDueForReview(p, today))
      .sort((a, b) => (a.lastReviewed ?? "").localeCompare(b.lastReviewed ?? ""));

    if (due.length === 0) {
      root.createEl("div", { text: "All projects reviewed. 🎉", cls: "gtd-empty" });
      return;
    }

    root.createEl("div", { cls: "gtd-review-count", text: `${due.length} project(s) to review` });
    for (const p of due) this.renderProject(root, p, today);
  }

  private renderProject(root: HTMLElement, p: Project, today: string) {
    const card = root.createDiv({ cls: "gtd-review-card" });
    const name = card.createEl("div", { cls: "gtd-project-name", text: p.name });
    name.onclick = () => {
      const file = this.app.vault.getFileByPath(p.path);
      if (file) this.app.workspace.getLeaf(false).openFile(file);
    };

    const open = p.tasks.filter((t) => !t.done);
    const avail = availableTasks(p, today);
    const info = [
      `${open.length} open / ${avail.length} available`,
      p.flow,
      p.lastReviewed ? `last reviewed ${p.lastReviewed}` : "never reviewed",
    ];
    card.createEl("div", { cls: "gtd-review-meta", text: info.join(" · ") });
    if (open.length > 0) {
      card.createEl("div", { cls: "gtd-review-next", text: "Next: " + (avail[0]?.text ?? "(nothing available)") });
    } else {
      card.createEl("div", { cls: "gtd-review-next gtd-review-stalled", text: "No open tasks — complete or drop?" });
    }

    const btn = card.createEl("button", { cls: "gtd-review-btn", text: "Mark reviewed" });
    btn.onclick = async () => {
      btn.disabled = true;
      await this.markReviewed(p);
    };
  }

  private async markReviewed(p: Project) {
    const file = this.app.vault.getFileByPath(p.path);
    if (!(file instanceof TFile)) return;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm["last-reviewed"] = todayISO();
    });
  }
}
