import { parseTaskLine } from "./parser";

export type InsertPosition = "top" | "bottom";

const ARCHIVE_HEADING_RE = /^##+\s+Archive\s*$/;

// "bottom" = after the last active task (always above ## Archive);
// "top" = before the first task; falls back to bottom when there are none
export function insertTaskLine(content: string, line: string, pos: InsertPosition): string {
  const lines = content.split("\n");
  const headingIdx = lines.findIndex((l) => ARCHIVE_HEADING_RE.test(l));
  const limit = headingIdx === -1 ? lines.length : headingIdx;

  let at = -1;
  if (pos === "top") {
    for (let i = 0; i < limit; i++) {
      if (parseTaskLine(lines[i], i)) {
        at = i;
        break;
      }
    }
  }
  if (at === -1) {
    // after the last task line before the archive; else end of pre-archive body
    at = limit;
    for (let i = limit - 1; i >= 0; i--) {
      if (parseTaskLine(lines[i], i)) {
        at = i + 1;
        break;
      }
      if (lines[i].trim() !== "") {
        at = i + 1;
        break;
      }
    }
  }
  lines.splice(at, 0, line);
  return lines.join("\n");
}
