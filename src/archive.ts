import { parseTaskLine } from "./parser";
import { addInterval } from "./engine";
import { blockEnd } from "./taskBlock";

const ARCHIVE_HEADING_RE = /^##+\s+Archive\s*$/;

export interface ArchiveResult {
  content: string;
  moved: number;
}

// Moves fully-done root subtrees (older than minAgeDays) under a trailing
// "## Archive" heading. Indented notes and plain sub-bullets travel with their
// task. Done children inside open groups stay in place.
export function archiveDoneTasks(content: string, today: string, minAgeDays: number): ArchiveResult {
  const lines = content.split("\n");
  const headingIdx = lines.findIndex((l) => ARCHIVE_HEADING_RE.test(l));
  const limit = headingIdx === -1 ? lines.length : headingIdx;

  const eligible = (l: string, n: number): boolean => {
    const t = parseTaskLine(l, n);
    if (!t || !t.done) return false; // covers both completed [x] and dropped [-]
    const resolvedOn = t.completedOn ?? t.cancelledOn;
    if (!resolvedOn) return true; // no date: age unknown, archive on request
    return addInterval(resolvedOn, `${minAgeDays}d`)! <= today;
  };

  const toMove = new Set<number>();
  let moved = 0;
  let i = 0;
  while (i < limit) {
    if (!parseTaskLine(lines[i], i)) {
      i++;
      continue;
    }
    const end = blockEnd(lines, i, limit);
    let tasks = 0;
    let all = true;
    for (let j = i; j < end; j++) {
      if (!parseTaskLine(lines[j], j)) continue;
      tasks++;
      if (!eligible(lines[j], j)) all = false;
    }
    if (all) {
      for (let j = i; j < end; j++) toMove.add(j);
      moved += tasks;
    }
    i = end;
  }

  if (toMove.size === 0) return { content, moved: 0 };

  const movedLines = lines.filter((_, j) => toMove.has(j));
  const keep = lines.filter((_, j) => !toMove.has(j));
  let out = keep.join("\n").trimEnd();
  if (headingIdx === -1) out += "\n\n## Archive";
  out += "\n" + movedLines.join("\n") + "\n";
  return { content: out, moved };
}
