export const indentOf = (line: string): number => line.match(/^\s*/)![0].length;

const isBlank = (line: string): boolean => line.trim() === "";

// Exclusive end of the block owned by the line at `start`: every deeper-indented
// line, notes included. Blank lines belong to it only when deeper content follows.
export function blockEnd(lines: string[], start: number, limit = lines.length): number {
  const indent = indentOf(lines[start]);
  let end = start + 1;
  while (end < limit) {
    if (isBlank(lines[end])) {
      let k = end;
      while (k < limit && isBlank(lines[k])) k++;
      if (k >= limit || indentOf(lines[k]) <= indent) break;
      end = k;
    } else if (indentOf(lines[end]) <= indent) break;
    else end++;
  }
  return end;
}
