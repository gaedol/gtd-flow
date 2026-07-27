const TASK_RE = /^(\s*)[-*] \[.\] /;

function indentOf(line: string | undefined): number | null {
  const m = line?.match(TASK_RE);
  return m ? m[1].length : null;
}

// the task at `line` plus its indented children: [start, end] inclusive
function blockAt(lines: string[], line: number): { start: number; end: number; indent: number } | null {
  const indent = indentOf(lines[line]);
  if (indent === null) return null;
  let end = line;
  for (let i = line + 1; i < lines.length; i++) {
    const ind = indentOf(lines[i]);
    if (ind === null || ind <= indent) break;
    end = i;
  }
  return { start: line, end, indent };
}

export interface LineMove {
  from: number; // first line of the rewritten span
  to: number; // last line of the rewritten span
  text: string; // replacement for that span
  cursorLine: number; // where the moved task ends up
}

// Move a task (with its subtree) above the previous sibling, or below the next
// one. Siblings are same-indent task lines with no intervening non-task line, so
// a move never jumps out of its list or into another action group. Returns null
// when there is nothing to swap with.
export function moveTaskBlock(lines: string[], line: number, dir: "up" | "down"): LineMove | null {
  const block = blockAt(lines, line);
  if (!block) return null;
  const { start, end, indent } = block;

  if (dir === "up") {
    // nearest preceding line at the same indent, stopping at a break in the list
    let prev = -1;
    for (let i = start - 1; i >= 0; i--) {
      const ind = indentOf(lines[i]);
      if (ind === null || ind < indent) break;
      if (ind === indent) {
        prev = i;
        break;
      }
    }
    if (prev < 0) return null;
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
  const nextIndent = indentOf(lines[end + 1]);
  if (nextIndent === null || nextIndent !== indent) return null;
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
