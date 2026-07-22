import { ViewPlugin, EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import type GtdFlowPlugin from "./main";

// Intercept clicks on task checkboxes inside project notes / the inbox so a
// completion writes ✅ (and the 🔁 next occurrence) instead of a bare [x], and —
// when click-to-cycle is on — a first click moves the task to in-progress.
//
// A capture-phase listener on the editor DOM is used (not CM6 domEventHandlers):
// Obsidian's own Live Preview checkbox toggle runs on a later phase, so capturing
// here lets us stop it and rewrite the line ourselves. Non-scope notes and
// non-task checkboxes fall through to Obsidian's default.
export function gtdCheckboxClicks(plugin: GtdFlowPlugin) {
  return ViewPlugin.fromClass(
    class {
      private onClick: (evt: MouseEvent) => void;

      constructor(private view: EditorView) {
        this.onClick = (evt) => this.handle(evt);
        view.dom.addEventListener("click", this.onClick, { capture: true });
      }

      destroy() {
        this.view.dom.removeEventListener("click", this.onClick, { capture: true });
      }

      private handle(evt: MouseEvent) {
        if (!plugin.settings.handleEditorClicks) return;
        const target = evt.target as HTMLElement | null;
        const box = target?.closest<HTMLInputElement>("input.task-list-item-checkbox");
        if (!box) return;

        const file = this.view.state.field(editorInfoField).file;
        if (!file || !plugin.noteInScope(file.path)) return;

        const pos = this.view.posAtDOM(box);
        const docLine = this.view.state.doc.lineAt(pos);
        if (!plugin.routeCheckbox(file.path, docLine.number - 1, docLine.text)) return;

        // stop Obsidian's own toggle; we've rewritten the line ourselves
        evt.preventDefault();
        evt.stopPropagation();
      }
    }
  );
}
