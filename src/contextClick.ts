import { EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";

// Right-clicking doesn't reliably move the caret, so the editor-menu handler
// can't trust editor.getCursor() to point at the line under the pointer. This
// records the line actually right-clicked, for the menu to use instead.

interface ContextClick {
  path: string;
  line: number; // 0-based
  text: string;
  at: number;
}

let last: ContextClick | null = null;

export function contextClickTracker() {
  return EditorView.domEventHandlers({
    contextmenu: (evt: MouseEvent, view: EditorView) => {
      const file = view.state.field(editorInfoField).file;
      const pos = view.posAtCoords({ x: evt.clientX, y: evt.clientY });
      if (!file || pos == null) {
        last = null;
        return false;
      }
      const line = view.state.doc.lineAt(pos);
      last = { path: file.path, line: line.number - 1, text: line.text, at: Date.now() };
      return false; // observe only; the menu still opens normally
    },
  });
}

// the just-clicked line for this file, or null when stale / from another note
export function lastContextClick(path: string): ContextClick | null {
  if (!last || last.path !== path) return null;
  return Date.now() - last.at > 2000 ? null : last;
}
