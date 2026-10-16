import { Project } from "./types";

// A project's name together with its folder inside the projects folder, e.g.
// "Work/Q4 Planning". Folders are areas, so this shows the area, and it keeps
// same-named projects in different areas apart. Top-level projects keep their
// plain name.
export function projectLabelFor(path: string, projectsFolder: string): string {
  const base = projectsFolder.replace(/\/+$/, "");
  const rel = base && path.startsWith(base + "/") ? path.slice(base.length + 1) : path.replace(/.*\//, "");
  return rel.replace(/\.md$/, "");
}

// what views display and group by; falls back to the name for projects the
// index didn't label (the inbox, archived notes read on demand)
export function labelOf(p: Project): string {
  return p.label ?? p.name;
}
