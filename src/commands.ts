import { Notice } from "obsidian";
import type { Editor } from "obsidian";
import type GtdFlowPlugin from "./main";
import type { Task } from "./types";
import { NEXT_ACTIONS_VIEW } from "./nextActionsView";
import { FORECAST_VIEW } from "./forecastView";
import { REVIEW_VIEW } from "./reviewView";
import { PERSPECTIVE_VIEW } from "./perspectiveView";
import { TIMELINE_VIEW } from "./timelineView";
import { CaptureModal } from "./captureModal";
import { EditTaskModal } from "./editTaskModal";
import { NewProjectModal } from "./newProjectModal";
import { ProjectPropertiesModal } from "./projectPropertiesModal";
import { DoneReportModal } from "./doneReportModal";
import { ProjectSuggestModal, moveTask } from "./moveTask";
import { parseTaskLine } from "./parser";

// All command registrations. Kept out of main.ts so onload stays thin wiring.
export function registerCommands(plugin: GtdFlowPlugin): void {
  const add = plugin.addCommand.bind(plugin);
  const app = plugin.app;

  const opens: [string, string, string][] = [
    ["open-review", "Open review", REVIEW_VIEW],
    ["open-next-actions", "Open next actions", NEXT_ACTIONS_VIEW],
    ["open-forecast", "Open forecast", FORECAST_VIEW],
    ["open-perspectives", "Open perspectives", PERSPECTIVE_VIEW],
    ["open-timeline", "Open timeline", TIMELINE_VIEW],
  ];
  for (const [id, name, view] of opens) {
    add({ id, name, callback: () => plugin.activateView(view) });
  }

  add({ id: "capture-to-inbox", name: "Capture task", callback: () => new CaptureModal(app, plugin).open() });
  add({ id: "new-project", name: "New project", callback: () => new NewProjectModal(app, plugin).open() });
  add({ id: "export-done-report", name: "Export done report", callback: () => new DoneReportModal(app, plugin).open() });
  add({
    id: "insert-done-query",
    name: "Insert done query block",
    editorCallback: (editor) => editor.replaceSelection("```gtd-done\nrange: last-week\ngroup: project\n```\n"),
  });

  add({
    id: "move-task-to-project",
    name: "Move task under cursor to project",
    editorCallback: (editor, view) => {
      const task = taskAtCursor(editor);
      if (!view.file || !task) return;
      const file = view.file;
      new ProjectSuggestModal(app, plugin.projectNotes(), (p) => {
        if (p.path === file.path) return;
        void moveTask(app, file.path, task, p.path, plugin.settings.insertPosition);
      }).open();
    },
  });
  add({
    id: "edit-task",
    name: "Edit task under cursor",
    editorCallback: (editor, view) => {
      const task = taskAtCursor(editor);
      if (view.file && task) new EditTaskModal(app, plugin, view.file.path, task).open();
    },
  });
  add({
    id: "drop-task",
    name: "Drop (cancel) task under cursor",
    editorCallback: (editor, view) => {
      const task = taskAtCursor(editor);
      if (view.file && task) plugin.dropTask(view.file.path, task);
    },
  });
  add({
    id: "toggle-someday",
    name: "Toggle someday on task under cursor",
    editorCallback: (editor) => {
      const lineNo = editor.getCursor().line;
      const raw = editor.getLine(lineNo);
      const task = parseTaskLine(raw, lineNo);
      if (task) editor.setLine(lineNo, plugin.toggleSomedayLine(raw, task.tags));
    },
  });
  add({
    id: "toggle-important",
    name: "Toggle important on task under cursor",
    editorCallback: (editor) => {
      const lineNo = editor.getCursor().line;
      const raw = editor.getLine(lineNo);
      const task = parseTaskLine(raw, lineNo);
      if (task) editor.setLine(lineNo, plugin.toggleTagLine(raw, task.tags, plugin.settings.importantTag));
    },
  });

  add({
    id: "project-status-block",
    name: "Insert / update project status block",
    checkCallback: (checking) => {
      const file = app.workspace.getActiveFile();
      if (!file || !plugin.index.get(file.path)) return false;
      if (!checking) void plugin.writeStatusBlock(file, true);
      return true;
    },
  });
  add({
    id: "convert-to-project",
    name: "Convert current note to project",
    checkCallback: (checking) => {
      const file = app.workspace.getActiveFile();
      if (!file || plugin.index.get(file.path)) return false;
      if (!checking) void plugin.convertToProject(file);
      return true;
    },
  });
  add({
    id: "edit-project-properties",
    name: "Edit project properties",
    checkCallback: (checking) => {
      const file = app.workspace.getActiveFile();
      const project = file ? plugin.index.get(file.path) : undefined;
      if (!project) return false;
      if (!checking) new ProjectPropertiesModal(app, plugin, project).open();
      return true;
    },
  });
  add({
    id: "toggle-project-hold",
    name: "Toggle project on hold / active",
    checkCallback: (checking) => {
      const file = app.workspace.getActiveFile();
      const project = file ? plugin.index.get(file.path) : undefined;
      if (!file || !project) return false;
      if (!checking) {
        void app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
          fm["status"] = fm["status"] === "on-hold" ? "active" : "on-hold";
        });
        new Notice(`${project.name}: ${project.status === "on-hold" ? "active" : "on hold"}`);
      }
      return true;
    },
  });
  add({
    id: "archive-done-tasks",
    name: "Archive done tasks in this note",
    checkCallback: (checking) => {
      const file = app.workspace.getActiveFile();
      if (!file || !plugin.noteInScope(file.path)) return false;
      if (!checking) void plugin.archiveNote(file).then((n) => new Notice(`Archived ${n} task(s)`));
      return true;
    },
  });
  add({
    id: "archive-done-tasks-all",
    name: "Archive done tasks in all projects",
    callback: async () => {
      let total = 0;
      for (const p of plugin.projectNotes()) {
        const f = app.vault.getFileByPath(p.path);
        if (f) total += await plugin.archiveNote(f);
      }
      new Notice(`Archived ${total} task(s) across all projects`);
    },
  });
  add({
    id: "archive-project",
    name: "Archive current project (complete + move)",
    checkCallback: (checking) => {
      const file = app.workspace.getActiveFile();
      if (!file || !plugin.index.get(file.path)) return false;
      if (!checking) void plugin.archiveProject(file);
      return true;
    },
  });
}

// task under the cursor, notifying if the line isn't a task
function taskAtCursor(editor: Editor): Task | null {
  const lineNo = editor.getCursor().line;
  const task = parseTaskLine(editor.getLine(lineNo), lineNo);
  if (!task) new Notice("Cursor is not on a task line");
  return task;
}
