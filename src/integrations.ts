import { Notice } from "obsidian";
import type GtdFlowPlugin from "./main";
import { NEXT_ACTIONS_VIEW } from "./nextActionsView";
import { FORECAST_VIEW } from "./forecastView";
import { REVIEW_VIEW } from "./reviewView";
import { PERSPECTIVE_VIEW } from "./perspectiveView";
import { TIMELINE_VIEW } from "./timelineView";
import { CaptureModal } from "./captureModal";
import { DoneBlock } from "./doneBlock";
import { TaskSuggest } from "./taskSuggest";
import { gtdEditorDecorations } from "./editorDecorations";
import { gtdCheckboxClicks } from "./checkboxClicks";
import { contextClickTracker } from "./contextClick";
import { overdueCount } from "./engine";
import { taskContainers } from "./selectors";
import { buildLineClasses } from "./inNote";
import { todayISO } from "./dates";

const TASK_LINE_RE = /^\s*[-*] \[.\] /;

// Ribbon, status bar, editor extensions, code block, suggester, protocol
// handler, project-style refresh, and the reading-mode post-processor.
export function registerIntegrations(plugin: GtdFlowPlugin): void {
  const app = plugin.app;

  const ribbon: [string, string, string, () => void][] = [
    ["list-checks", "GTD: Next actions", "gtd-ribbon-next", () => plugin.activateView(NEXT_ACTIONS_VIEW)],
    ["calendar-clock", "GTD: Forecast", "gtd-ribbon-forecast", () => plugin.activateView(FORECAST_VIEW)],
    ["eye", "GTD: Review", "gtd-ribbon-review", () => plugin.activateView(REVIEW_VIEW)],
    ["telescope", "GTD: Perspectives", "gtd-ribbon-perspectives", () => plugin.activateView(PERSPECTIVE_VIEW)],
    ["gantt-chart", "GTD: Timeline", "gtd-ribbon-timeline", () => plugin.activateView(TIMELINE_VIEW)],
    ["plus-circle", "GTD: Capture task", "gtd-ribbon-capture", () => new CaptureModal(app, plugin).open()],
  ];
  for (const [icon, label, cls, fn] of ribbon) plugin.addRibbonIcon(icon, label, fn).addClass(cls);

  plugin.registerMarkdownCodeBlockProcessor("gtd-done", (source, el, ctx) => {
    ctx.addChild(new DoneBlock(el, plugin, source));
  });
  plugin.registerEditorSuggest(new TaskSuggest(app, plugin));

  // refresh an existing status block when its project note is opened
  plugin.registerEvent(
    app.workspace.on("file-open", (file) => {
      if (file && plugin.index.get(file.path)) void plugin.writeStatusBlock(file, false);
    })
  );

  // obsidian://gtd-capture?vault=...&text=...&due=YYYY-MM-DD&defer=YYYY-MM-DD
  plugin.registerObsidianProtocolHandler("gtd-capture", async (params) => {
    const text = (params.text ?? params.task ?? "").trim();
    if (!text) {
      new CaptureModal(app, plugin).open();
      return;
    }
    let line = `- [ ] ${text}`;
    if (params.defer) line += ` 🛫 ${params.defer}`;
    if (params.due) line += ` 📅 ${params.due}`;
    await plugin.appendTaskLine(await plugin.ensureInboxFile(), line);
    new Notice("Captured to inbox: " + text);
  });

  // last + isolated: an editor-extension failure must not take down the plugin
  try {
    plugin.registerEditorExtension(gtdEditorDecorations(plugin));
    plugin.registerEditorExtension(gtdCheckboxClicks(plugin));
    plugin.registerEditorExtension(contextClickTracker());
    plugin.index.on("changed", () => app.workspace.updateOptions());
  } catch (e) {
    console.error("GTD Flow: in-note Live Preview decorations disabled", e);
  }

  const statusBar = plugin.addStatusBarItem();
  statusBar.addClass("gtd-statusbar");
  statusBar.onclick = () => plugin.activateView(FORECAST_VIEW);
  plugin.index.on("changed", () => {
    const n = overdueCount(taskContainers(plugin.index.snapshot()), todayISO());
    statusBar.setText(n > 0 ? `${n} overdue` : "");
    statusBar.toggleClass("gtd-statusbar-alert", n > 0);
  });

  plugin.index.on("changed", () => plugin.applyProjectStyles());
  plugin.registerEvent(app.workspace.on("layout-change", () => plugin.applyProjectStyles()));
  plugin.registerEvent(app.workspace.on("active-leaf-change", () => plugin.applyProjectStyles()));

  plugin.registerMarkdownPostProcessor((el, ctx) => {
    const project = plugin.index.get(ctx.sourcePath);
    if (!project) return;
    const info = ctx.getSectionInfo(el);
    if (!info) return;
    const lines = info.text.split("\n");
    const classes = buildLineClasses(project, lines, todayISO());
    const taskLines: number[] = [];
    for (let i = info.lineStart; i <= info.lineEnd; i++) {
      if (classes.has(i) || TASK_LINE_RE.test(lines[i] ?? "")) taskLines.push(i);
    }
    const scoped = plugin.noteInScope(ctx.sourcePath);
    el.querySelectorAll("li.task-list-item").forEach((li, idx) => {
      const srcLine = taskLines[idx];
      const cls = classes.get(srcLine);
      if (cls) li.classList.add(...cls.split(" "));
      // reading-mode completion: route the checkbox through GTD Flow so ✅ +
      // 🔁 recurrence happen, matching the editor/views behaviour
      if (!scoped) return;
      const box = li.querySelector<HTMLInputElement>("input.task-list-item-checkbox");
      const raw = lines[srcLine];
      if (!box || raw === undefined) return;
      plugin.registerDomEvent(
        box,
        "click",
        (evt) => {
          if (!plugin.settings.handleEditorClicks) return;
          if (plugin.routeCheckbox(ctx.sourcePath, srcLine, raw)) {
            evt.preventDefault();
            evt.stopPropagation();
          }
        },
        { capture: true }
      );
    });
  });
}
