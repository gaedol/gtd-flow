import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
  normalizePath,
} from "obsidian";
import type GtdFlowPlugin from "./main";
import { todayISO } from "./dates";
import { addInterval } from "./engine";

interface Suggestion {
  label: string;
  detail?: string;
  insert: string;
}

const TASK_LINE_RE = /^\s*[-*] \[.\] /;
const MARKER_DATE_RE = /[🛫📅⏳] *([\w-]*)$/u;
const REPEAT_PARTIAL_RE = /🔁 *([a-z0-9 ]*)$/u;
const FIELD_WORD_RE = /(?:^|\s)([a-zA-Z]*)$/;

type Mode = "field" | "date" | "repeat";

export class TaskSuggest extends EditorSuggest<Suggestion> {
  private mode: Mode = "field";

  constructor(app: App, private plugin: GtdFlowPlugin) {
    super(app);
  }

  private inScope(file: TFile | null): boolean {
    if (!file) return false;
    const s = this.plugin.settings;
    return (
      file.path.startsWith(s.projectsFolder + "/") ||
      file.path === normalizePath(s.inboxNote)
    );
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!this.inScope(file)) return null;
    const line = editor.getLine(cursor.line);
    if (!TASK_LINE_RE.test(line)) return null;
    if (cursor.ch < line.length) return null; // only at end of line
    const before = line.slice(0, cursor.ch);

    const date = before.match(MARKER_DATE_RE);
    if (date) {
      this.mode = "date";
      return this.info(cursor, date[1]);
    }
    const rep = before.match(REPEAT_PARTIAL_RE);
    if (rep) {
      this.mode = "repeat";
      return this.info(cursor, rep[1]);
    }
    const word = before.match(FIELD_WORD_RE);
    if (word && before.replace(TASK_LINE_RE, "").trim().length + word[1].length > 0) {
      this.mode = "field";
      return this.info(cursor, word[1]);
    }
    return null;
  }

  private info(cursor: EditorPosition, query: string): EditorSuggestTriggerInfo {
    return {
      start: { line: cursor.line, ch: cursor.ch - query.length },
      end: cursor,
      query,
    };
  }

  getSuggestions(ctx: EditorSuggestContext): Suggestion[] {
    const q = ctx.query.toLowerCase();
    return this.candidates().filter(
      (s) => s.label.toLowerCase().startsWith(q) || s.insert.startsWith(q)
    );
  }

  private candidates(): Suggestion[] {
    if (this.mode === "field") {
      return [
        { label: "defer", detail: "🛫 start date", insert: "🛫 " },
        { label: "due", detail: "📅 due date", insert: "📅 " },
        { label: "repeat", detail: "🔁 recurrence", insert: "🔁 " },
        { label: "scheduled", detail: "⏳ scheduled date", insert: "⏳ " },
      ];
    }
    if (this.mode === "repeat") {
      return ["every day", "every week", "every 2 weeks", "every month", "every 3 months", "every year"].map(
        (r) => ({ label: r, insert: r + " " })
      );
    }
    const today = todayISO();
    const rel: [string, string][] = [
      ["today", today],
      ["tomorrow", addInterval(today, "1d")!],
      ["in 3 days", addInterval(today, "3d")!],
      ["in a week", addInterval(today, "1w")!],
      ["in 2 weeks", addInterval(today, "2w")!],
      ["in a month", addInterval(today, "1m")!],
    ];
    return rel.map(([label, iso]) => ({ label, detail: iso, insert: iso + " " }));
  }

  renderSuggestion(s: Suggestion, el: HTMLElement): void {
    el.createSpan({ text: s.label });
    if (s.detail) el.createSpan({ cls: "gtd-suggest-detail", text: " " + s.detail });
  }

  selectSuggestion(s: Suggestion): void {
    const ctx = this.context;
    if (!ctx) return;
    ctx.editor.replaceRange(s.insert, ctx.start, ctx.end);
    const ch = ctx.start.ch + s.insert.length;
    ctx.editor.setCursor({ line: ctx.start.line, ch });
  }
}
