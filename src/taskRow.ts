import { App, MarkdownView, setIcon } from "obsidian";
import type GtdFlowPlugin from "./main";
import { Task } from "./types";

// Small building blocks shared by the task-listing surfaces (Next Actions,
// Forecast, Perspectives, the gtd-done block). Row *layout* stays per-view —
// only the genuinely identical pieces live here.

// open a note and put the cursor on a task's line
export async function openTaskLine(app: App, path: string, line?: number): Promise<void> {
  const file = app.vault.getFileByPath(path);
  if (!file) return;
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  if (line === undefined) return;
  app.workspace.getActiveViewOfType(MarkdownView)?.editor.setCursor({ line, ch: 0 });
}

// flag and important markers, in that order
export function renderMarkers(plugin: GtdFlowPlugin, row: HTMLElement, task: Task): void {
  if (task.tags.includes(plugin.settings.flagTag)) {
    const flag = row.createSpan({ cls: "gtd-flag", attr: { "aria-label": "Flagged" } });
    setIcon(flag, "flag");
  }
  plugin.importantFor(row, task);
}

// due-date badge, colored orange today / red when overdue
export function renderDueBadge(row: HTMLElement, task: Task, today: string): void {
  if (!task.due) return;
  row.createSpan({
    cls: "gtd-due" + (task.due < today ? " gtd-overdue" : task.due === today ? " gtd-due-today" : ""),
    text: task.due,
  });
}
