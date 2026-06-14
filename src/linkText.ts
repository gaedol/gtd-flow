import { App } from "obsidian";

export interface Segment {
  text: string;
  link?: string; // wikilink target when this segment is a link
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// split task text into plain runs and [[wikilink]] segments
export function parseWikiSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: (m[2] ?? m[1]).trim(), link: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  if (out.length === 0) out.push({ text });
  return out;
}

// render task text into a label span, turning [[links]] into clickable
// internal links; returns the span so callers can add a label-level click
export function renderTaskText(
  parent: HTMLElement,
  text: string,
  app: App,
  sourcePath: string
): HTMLElement {
  const span = parent.createSpan({ cls: "gtd-task-text" });
  for (const seg of parseWikiSegments(text)) {
    if (seg.link) {
      const a = span.createEl("a", { cls: "internal-link", text: seg.text });
      a.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        app.workspace.openLinkText(seg.link!, sourcePath, false);
      });
    } else {
      span.appendText(seg.text);
    }
  }
  return span;
}
