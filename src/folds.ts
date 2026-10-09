// Fold state for the Next Actions view, saved in settings so it survives
// restarts. Each foldable header has a key: a fixed section ("section:flagged"),
// a project ("project:<path>") or an inbox note ("note:<path>").

export const sectionKey = (name: "inbox" | "flagged" | "stalled" | "broken") => `section:${name}`;
export const projectKey = (path: string) => `project:${path}`;
export const noteKey = (path: string) => `note:${path}`;

// the note path a project/note key refers to; sections have none
function keyPath(key: string): string | null {
  const m = /^(?:project|note):(.*)$/.exec(key);
  return m ? m[1] : null;
}

// fold (or unfold) `keys` in the saved list. Keys for notes that are no longer
// indexed (deleted, renamed, archived) are dropped on the way, so the list
// doesn't grow forever.
export function setFolded(saved: string[], keys: string[], fold: boolean, isIndexed: (path: string) => boolean): string[] {
  const next = new Set(saved.filter((k) => {
    const path = keyPath(k);
    return path === null || isIndexed(path);
  }));
  for (const k of keys) {
    if (fold) next.add(k);
    else next.delete(k);
  }
  return [...next].sort();
}
