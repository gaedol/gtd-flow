import { ItemView, WorkspaceLeaf, MarkdownView, setIcon } from "obsidian";
import type GtdFlowPlugin from "./main";
import { forecast, ForecastItem } from "./engine";
import { todayISO } from "./dates";
import { completeTask } from "./completeTask";
import { renderTaskText } from "./linkText";
import { defaultSort, applyManualOrder } from "./ordering";
import { makeReorderable } from "./dragReorder";
import { ensureBlockId } from "./blockId";

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

    const flagTag = this.plugin.settings.flagTag;
    for (const [date, dayItems] of byDate) {
      const day = root.createDiv({ cls: "gtd-day" });
      day.createEl("div", { cls: "gtd-day-header", text: dayLabel(date, today) });
      const rowsEl = day.createDiv({ cls: "gtd-day-rows" });
      // default order (overdue → flagged → rest), then the user's saved arrangement
      const ordered = applyManualOrder(
        defaultSort(dayItems, today, flagTag),
        this.plugin.settings.forecastOrder[date] ?? []
      );
      const keyToItem = new Map<string, ForecastItem>();
      ordered.forEach((it, i) => {
        const key = it.task.blockId ?? `t${i}`;
        keyToItem.set(key, it);
        this.renderItem(rowsEl, it, today, key);
      });
      makeReorderable(rowsEl, (keys) => {
        void this.saveDayOrder(date, keys.map((k) => keyToItem.get(k)).filter((x): x is ForecastItem => !!x));
      });
    }
  }

  // assign block ids to the day's tasks as needed, then persist their order
  private async saveDayOrder(date: string, items: ForecastItem[]) {
    const ids: string[] = [];
    for (const it of items) {
      const id = await ensureBlockId(this.app, it.project.path, it.task);
      if (id) ids.push(id);
    }
    this.plugin.settings.forecastOrder[date] = ids;
    await this.plugin.persistData();
  }

  private renderItem(parent: HTMLElement, it: ForecastItem, today: string, key: string) {
    const row = parent.createDiv({ cls: "gtd-task" });
    row.dataset.gtdKey = key;
    const grip = row.createSpan({ cls: "gtd-grip", attr: { "aria-label": "Drag to reorder" } });
    setIcon(grip, "grip-vertical");
    if (it.kind === "due") {
      const cb = row.createEl("input", { type: "checkbox" });
      if (!it.available) {
        // blocked action (waiting on order/subtasks): show the deadline but not actionable
        cb.disabled = true;
        row.addClass("gtd-blocked-row");
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
