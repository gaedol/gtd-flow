import { Editor, TFile, normalizePath } from "obsidian";
import type GtdFlowPlugin from "./main";
import { parseTaskLine } from "./parser";
import { completeTask } from "./completeTask";
import { EditTaskModal } from "./editTaskModal";
import { NewProjectModal } from "./newProjectModal";

// Context menus: the file-explorer menu (convert / new project) and the
// editor task-line menu (edit / complete / drop / important / someday).
export function registerMenus(plugin: GtdFlowPlugin): void {
  const app = plugin.app;

  plugin.registerEvent(
    app.workspace.on("file-menu", (menu, file) => {
      const folder = normalizePath(plugin.settings.projectsFolder);
      if (file instanceof TFile && file.extension === "md" && !plugin.index.get(file.path)) {
        menu.addItem((i) =>
          i.setTitle("Convert to GTD project").setIcon("list-checks").onClick(() => plugin.convertToProject(file))
        );
      } else if (!(file instanceof TFile) && (file.path === folder || folder.startsWith(file.path + "/"))) {
        menu.addItem((i) =>
          i.setTitle("New GTD project").setIcon("list-checks").onClick(() => new NewProjectModal(app, plugin).open())
        );
      }
    })
  );

  plugin.registerEvent(
    app.workspace.on("editor-menu", (menu, editor: Editor, view) => {
      const file = view.file;
      if (!file || !plugin.noteInScope(file.path)) return;
      const lineNo = editor.getCursor().line;
      const raw = editor.getLine(lineNo);
      const task = parseTaskLine(raw, lineNo);
      if (!task) return;
      const path = file.path;
      menu.addSeparator();
      menu.addItem((i) =>
        i.setTitle("Edit task").setIcon("pencil").onClick(() => new EditTaskModal(app, plugin, path, task).open())
      );
      if (task.done) return;
      menu.addItem((i) =>
        i.setTitle("Complete task").setIcon("check").onClick(() => void completeTask(app, path, task))
      );
      menu.addItem((i) =>
        i.setTitle("Drop task…").setIcon("x-circle").onClick(() => plugin.dropTask(path, task))
      );
      const isImportant = task.tags.includes(plugin.settings.importantTag);
      menu.addItem((i) =>
        i
          .setTitle(isImportant ? "Remove important" : "Mark important")
          .setIcon("star")
          .onClick(() => editor.setLine(lineNo, plugin.toggleTagLine(raw, task.tags, plugin.settings.importantTag)))
      );
      const isSomeday = task.tags.includes(plugin.settings.somedayTag);
      menu.addItem((i) =>
        i
          .setTitle(isSomeday ? "Remove someday" : "Mark someday")
          .setIcon("clock")
          .onClick(() => editor.setLine(lineNo, plugin.toggleSomedayLine(raw, task.tags)))
      );
    })
  );
}
