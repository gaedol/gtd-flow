import { parseTaskLine } from "./parser";
import { addInterval } from "./engine";

const ARCHIVE_HEADING_RE = /^##+\s+Archive\s*$/;

export interface ArchiveResult {
  content: string;
  moved: number;
}

// Moves fully-done root subtrees (older than minAgeDays) under a trailing
// "## Archive" heading. Done children inside open groups stay in place.
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
  let i = 0;
  while (i < limit) {
    const t = parseTaskLine(lines[i], i);
    if (!t) {
      i++;
      continue;
    }
    let end = i + 1;
    while (end < limit) {
      const c = parseTaskLine(lines[end], end);
      if (!c || c.indent <= t.indent) break;
      end++;
    }
    let all = true;
    for (let j = i; j < end; j++) if (!eligible(lines[j], j)) all = false;
    if (all) for (let j = i; j < end; j++) toMove.add(j);
    i = end;
  }

  if (toMove.size === 0) return { content, moved: 0 };

  const movedLines = lines.filter((_, j) => toMove.has(j));
  const keep = lines.filter((_, j) => !toMove.has(j));
  let out = keep.join("\n").trimEnd();
  if (headingIdx === -1) out += "\n\n## Archive";
  out += "\n" + movedLines.join("\n") + "\n";
  return { content: out, moved: toMove.size };
}
