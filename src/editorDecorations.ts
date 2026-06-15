import { ViewPlugin, ViewUpdate, EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { editorInfoField } from "obsidian";
import type GtdFlowPlugin from "./main";
import { buildLineClasses } from "./inNote";
import { todayISO } from "./dates";

export function gtdEditorDecorations(plugin: GtdFlowPlugin) {
  function build(view: EditorView): DecorationSet {
    const file = view.state.field(editorInfoField).file;
    const project = file ? plugin.index.get(file.path) : undefined;
    if (!project) return Decoration.none;

    const doc = view.state.doc;
    const lines: string[] = [];
    for (let i = 1; i <= doc.lines; i++) lines.push(doc.line(i).text);
    const classes = buildLineClasses(project, lines, todayISO());

    const b = new RangeSetBuilder<Decoration>();
    for (let i = 1; i <= doc.lines; i++) {
      const cls = classes.get(i - 1);
      if (cls) {
        const from = doc.line(i).from;
        b.add(from, from, Decoration.line({ class: cls }));
      }
    }
    return b.finish();
  }

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
      }
    },
    { decorations: (v: { decorations: DecorationSet }) => v.decorations }
  );
}
