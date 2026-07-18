import { EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import type GtdFlowPlugin from "./main";

// Intercept clicks on task checkboxes inside project notes / the inbox so a
// completion writes ✅ (and the 🔁 next occurrence) instead of a bare [x], and —
// when click-to-cycle is on — a first click moves the task to in-progress.
// Non-scope notes and non-task checkboxes fall through to Obsidian's default.
export function gtdCheckboxClicks(plugin: GtdFlowPlugin) {
  const handle = (evt: MouseEvent, view: EditorView): boolean => {
    if (!plugin.settings.handleEditorClicks) return false;
    const target = evt.target as HTMLElement | null;
    if (!target || !target.matches("input.task-list-item-checkbox")) return false;

    const file = view.state.field(editorInfoField).file;
    if (!file || !plugin.noteInScope(file.path)) return false;

    const pos = view.posAtDOM(target);
    const docLine = view.state.doc.lineAt(pos);
    if (!plugin.routeCheckbox(file.path, docLine.number - 1, docLine.text)) return false;

    // stop Obsidian's own toggle; we've rewritten the line ourselves
    evt.preventDefault();
    evt.stopPropagation();
    return true;
  };

  // mousedown fires before Obsidian's checkbox handler, so preventing it there
  // reliably suppresses the default toggle
  return EditorView.domEventHandlers({ mousedown: handle });
}
