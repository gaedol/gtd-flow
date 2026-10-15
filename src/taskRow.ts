import { App, MarkdownView, setIcon } from "obsidian";
import type GtdFlowPlugin from "./main";
import { Task } from "./types";
import { addInterval, openBlockers } from "./engine";

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

// due-date badge: red overdue, orange today, amber within the warning window
export function renderDueBadge(row: HTMLElement, task: Task, today: string, soonDays = 0): void {
  if (!task.due) return;
  let cls = "gtd-due";
  if (task.due < today) cls += " gtd-overdue";
  else if (task.due === today) cls += " gtd-due-today";
  else if (soonDays > 0 && task.due <= addInterval(today, `${soonDays}d`)!) cls += " gtd-due-soon";
  row.createSpan({ cls, text: task.due });
}

// "⛔ waiting on …" for a task held back by unfinished dependencies
export function renderBlockers(row: HTMLElement, task: Task): void {
  const blockers = openBlockers(task);
  if (blockers.length === 0) return;
  const more = blockers.length > 1 ? ` +${blockers.length - 1}` : "";
  row.createSpan({ cls: "gtd-blockers", text: `⛔ waiting on ${blockers[0].text}${more}` });
}
