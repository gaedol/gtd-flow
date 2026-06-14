import { ItemView, WorkspaceLeaf, MarkdownView, setIcon } from "obsidian";
import type GtdFlowPlugin from "./main";
import { forecast, ForecastItem } from "./engine";
import { todayISO } from "./dates";
import { completeTask } from "./completeTask";
import { renderTaskText } from "./linkText";

export const FORECAST_VIEW = "gtd-forecast";

export class ForecastView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: GtdFlowPlugin) {
    super(leaf);
  }

  getViewType() {
    return FORECAST_VIEW;
  }

  getDisplayText() {
    return "Forecast";
  }

  getIcon() {
    return "calendar-clock";
  }

  async onOpen() {
    this.registerEvent(this.plugin.index.on("changed", () => this.render()));
    this.render();
  }

  private render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("gtd-forecast");

    const today = todayISO();
    const items = forecast(this.plugin.index.all(), today, this.plugin.settings.forecastDays);

    if (items.length === 0) {
      root.createEl("div", {
        text: `Nothing due or becoming available in the next ${this.plugin.settings.forecastDays} days.`,
        cls: "gtd-empty",
      });
      return;
    }

    const byDate = new Map<string, ForecastItem[]>();
    for (const it of items) {
      (byDate.get(it.date) ?? byDate.set(it.date, []).get(it.date)!).push(it);
    }

    for (const [date, dayItems] of byDate) {
      const day = root.createDiv({ cls: "gtd-day" });
      day.createEl("div", { cls: "gtd-day-header", text: dayLabel(date, today) });
      for (const it of dayItems) this.renderItem(day, it, today);
    }
  }

  private renderItem(parent: HTMLElement, it: ForecastItem, today: string) {
    const row = parent.createDiv({ cls: "gtd-task" });
    if (it.kind === "due") {
      const cb = row.createEl("input", { type: "checkbox" });
      cb.onclick = async () => {
        cb.disabled = true;
        await completeTask(this.app, it.project.path, it.task);
      };
      if (it.task.due! < today) row.addClass("gtd-overdue-row");
    } else {
      const icon = row.createSpan({ cls: "gtd-avail-icon", attr: { "aria-label": "Becomes available" } });
      setIcon(icon, "play");
    }
    if (it.task.tags.includes(this.plugin.settings.flagTag)) {
      const flag = row.createSpan({ cls: "gtd-flag", attr: { "aria-label": "Flagged" } });
      setIcon(flag, "flag");
    }
    const label = renderTaskText(row, it.task.text, this.app, it.project.path);
    label.onclick = () => this.openTask(it);
    row.createSpan({ cls: "gtd-project-ref", text: it.project.name });
  }

  private async openTask(it: ForecastItem) {
    const file = this.app.vault.getFileByPath(it.project.path);
    if (!file) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    view?.editor.setCursor({ line: it.task.line, ch: 0 });
  }
}

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  const d = new Date(date + "T00:00:00");
  const t = new Date(today + "T00:00:00");
  const days = Math.round((d.getTime() - t.getTime()) / 86400000);
  const name = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return days === 1 ? `Tomorrow — ${name}` : name;
}
