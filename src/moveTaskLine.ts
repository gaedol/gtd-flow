import { blockEnd, indentOf } from "./taskBlock";

const TASK_RE = /^(\s*)[-*] \[.\] /;

function taskIndent(line: string | undefined): number | null {
  const m = line?.match(TASK_RE);
  return m ? m[1].length : null;
}

// the task at `line` plus its indented children and notes: [start, end] inclusive
function blockAt(lines: string[], line: number): { start: number; end: number; indent: number } | null {
  const indent = taskIndent(lines[line]);
  if (indent === null) return null;
  return { start: line, end: blockEnd(lines, line) - 1, indent };
}

export interface LineMove {
  from: number; // first line of the rewritten span
  to: number; // last line of the rewritten span
  text: string; // replacement for that span
  cursorLine: number; // where the moved task ends up
}

// Move a task (with its subtree and notes) above the previous sibling, or below the
// next one. Siblings are same-indent tasks whose blocks touch, so
// a move never jumps out of its list or into another action group. Returns null
// when there is nothing to swap with.
export function moveTaskBlock(lines: string[], line: number, dir: "up" | "down"): LineMove | null {
  const block = blockAt(lines, line);
  if (!block) return null;
  const { start, end, indent } = block;

  if (dir === "up") {
    // nearest shallower-or-equal line above; a sibling only if its block ends right here
    let prev = start - 1;
    while (prev >= 0 && (lines[prev].trim() === "" || indentOf(lines[prev]) > indent)) prev--;
    if (prev < 0 || taskIndent(lines[prev]) !== indent || blockEnd(lines, prev) !== start) return null;
    const moved = lines.slice(start, end + 1);
    const displaced = lines.slice(prev, start);
    return {
      from: prev,
      to: end,
      text: [...moved, ...displaced].join("\n"),
      cursorLine: prev,
    };
  }

  // down: the next sibling starts immediately after this block
  if (taskIndent(lines[end + 1]) !== indent) return null;
  const nextBlock = blockAt(lines, end + 1);
  if (!nextBlock) return null;
  const moved = lines.slice(start, end + 1);
  const displaced = lines.slice(end + 1, nextBlock.end + 1);
  return {
    from: start,
    to: nextBlock.end,
    text: [...displaced, ...moved].join("\n"),
    cursorLine: start + displaced.length,
  };
}
