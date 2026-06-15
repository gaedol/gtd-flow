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
import { dateChoices } from "./dateParse";

interface Suggestion {
  label: string;
  detail?: string;
  insert: string;
  keywords?: string[]; // alternative words that match this option
}

const TASK_LINE_RE = /^\s*[-*] \[.\] /;
const MARKER_DATE_RE = /[🛫📅⏳] *([\w-]*)$/u;
const REPEAT_PARTIAL_RE = /🔁 *([a-z0-9 ]*)$/u;
const DURATION_PARTIAL_RE = /⏱ *([\w]*)$/u;
const TIME_PARTIAL_RE = /⏰ *([\d:]*)$/u;
const FIELD_WORD_RE = /(?:^|\s)([a-zA-Z]*)$/;

type Mode = "field" | "date" | "repeat" | "duration" | "time";

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
    const dur = before.match(DURATION_PARTIAL_RE);
    if (dur) {
      this.mode = "duration";
      return this.info(cursor, dur[1]);
    }
    const tm = before.match(TIME_PARTIAL_RE);
    if (tm) {
      this.mode = "time";
      return this.info(cursor, tm[1]);
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
    return this.candidates().filter((s) => {
      const words = [s.label, ...(s.keywords ?? [])];
      return words.some((w) => w.toLowerCase().startsWith(q)) || s.insert.startsWith(q);
    });
  }

  private candidates(): Suggestion[] {
    if (this.mode === "field") {
      return [
        { label: "defer", detail: "🛫 start date", insert: "🛫 ", keywords: ["start", "hide", "available"] },
        { label: "due", detail: "📅 due date", insert: "📅 ", keywords: ["deadline", "by"] },
        { label: "repeat", detail: "🔁 recurrence", insert: "🔁 ", keywords: ["recur", "recurring", "every"] },
        { label: "scheduled", detail: "⏳ scheduled date", insert: "⏳ ", keywords: ["plan", "planned", "schedule"] },
        { label: "duration", detail: "⏱ estimated time", insert: "⏱ ", keywords: ["estimate", "est", "takes"] },
        { label: "time", detail: "⏰ time of day", insert: "⏰ ", keywords: ["at", "clock", "schedule"] },
      ];
    }
    if (this.mode === "time") {
      return ["08:00", "09:00", "10:00", "12:00", "14:00", "16:00", "18:00"].map((t) => ({
        label: t,
        insert: t + " ",
      }));
    }
    if (this.mode === "duration") {
      return ["15m", "30m", "45m", "1h", "1h30m", "2h", "4h"].map((d) => ({
        label: d,
        insert: d + " ",
      }));
    }
    if (this.mode === "repeat") {
      return ["every day", "every week", "every 2 weeks", "every month", "every 3 months", "every year"].map(
        (r) => ({ label: r, insert: r + " " })
      );
    }
    return dateChoices(todayISO()).map((c) => ({
      label: c.label,
      detail: c.date,
      insert: c.date + " ",
    }));
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
