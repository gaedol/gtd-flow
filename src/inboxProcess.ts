import { blockEnd, indentOf } from "./taskBlock";
import { parseTaskLine } from "./parser";
import { Project } from "./types";
import { labelOf } from "./projectLabel";

// The text side of processing an inbox item: cutting a task out of a note
// together with its subtasks and notes, and shaping the note it turns into.

// shift a block left so its shallowest line starts at column 0
export function dedent(lines: string[]): string[] {
  const depth = Math.min(...lines.filter((l) => l.trim()).map(indentOf));
  return lines.map((l) => (l.trim() ? l.slice(depth) : l));
}

// remove the task at `line` with everything it owns; null when the line isn't a task
export function cutTaskBlock(content: string, line: number): { content: string; block: string[] } | null {
  const lines = content.split("\n");
  if (!parseTaskLine(lines[line] ?? "", line)) return null;
  const end = blockEnd(lines, line);
  const block = dedent(lines.splice(line, end - line));
  return { content: lines.join("\n"), block };
}

// a file name from task text: wikilinks reduced to their label, characters
// that aren't allowed in note names removed
export function noteNameFor(text: string): string {
  return text
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .trim();
}

// body of a project made from an inbox item: the item and its subtasks, so no
// date or tag is lost; a bare one-liner becomes an empty first step instead,
// since repeating the project name as a task adds nothing
export function projectBody(block: string[]): string {
  const head = parseTaskLine(block[0], 0)!;
  const bare = block.length === 1 && head.tags.length === 0 && block[0].trim() === `- [ ] ${head.text}`;
  return (bare ? "- [ ] " : block.join("\n")) + "\n";
}

// body of a reference note: the item's text (checkbox removed) and its notes
export function referenceBody(block: string[]): string {
  const [first, ...rest] = block;
  const text = first.replace(/^\s*[-*] \[.\] /, "");
  return [text, ...(rest.length ? ["", ...rest] : [])].join("\n") + "\n";
}

// the project a "default project" setting names, by label, name or path
export function findProject(projects: Project[], name: string): Project | undefined {
  const n = name.trim().replace(/\.md$/, "");
  if (!n) return undefined;
  return projects.find((p) => labelOf(p) === n || p.name === n || p.path.replace(/\.md$/, "") === n);
}
