import { App, TFile, Events } from "obsidian";
import { Project, Task } from "./types";
import { parseProject, parseTaskLine } from "./parser";

// What the index covers. "vault": every note outside the ignored folders —
// project notes are projects, any other note with tasks is an inbox.
// "single": the projects folder plus one configured inbox note.
export interface IndexScope {
  mode: "vault" | "single";
  projectsFolder: string;
  inboxNote: string;
  ignoredFolders: string[];
}

function inFolder(path: string, folder: string): boolean {
  return !!folder && path.startsWith(folder + "/");
}

// In-memory project index; markdown stays the source of truth
export class TaskIndex extends Events {
  // single source of truth: real project notes plus inbox notes, each held as
  // a synthesized project of kind "inbox". get() hides inbox notes so
  // project-note logic is unaffected; selectors decide per-surface inclusion.
  private projects = new Map<string, Project>();

  constructor(
    private app: App,
    private scope: () => IndexScope
  ) {
    super();
  }

  // raw set of every indexed container (real projects + inbox notes); use the
  // selectors in selectors.ts to pick per surface
  snapshot(): Project[] {
    return [...this.projects.values()];
  }

  // a project note (inbox notes aren't projects)
  get(path: string): Project | undefined {
    const p = this.projects.get(path);
    return p?.kind === "inbox" ? undefined : p;
  }

  // any indexed note: a project or an inbox note
  has(path: string): boolean {
    return this.projects.has(path);
  }

  async rebuild(): Promise<void> {
    this.projects.clear();
    const scope = this.scope();
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.inScope(f, scope));
    await Promise.all(files.map((f) => this.indexFile(f, scope)));
    this.trigger("changed");
  }

  async update(file: TFile): Promise<void> {
    const scope = this.scope();
    if (!this.inScope(file, scope)) return;
    // only re-render when the index actually changed: in vault mode most
    // edits land in notes without tasks
    if (await this.indexFile(file, scope)) this.trigger("changed");
  }

  remove(path: string): void {
    if (this.projects.delete(path)) this.trigger("changed");
  }

  // whether a note at this path falls inside the index's scope, whether or
  // not it holds tasks yet
  covers(path: string): boolean {
    return this.pathInScope(path, this.scope());
  }

  private inScope(file: TFile, scope: IndexScope): boolean {
    return file.extension === "md" && this.pathInScope(file.path, scope);
  }

  private pathInScope(path: string, scope: IndexScope): boolean {
    if (scope.mode === "single") {
      return inFolder(path, scope.projectsFolder) || path === scope.inboxNote;
    }
    return !scope.ignoredFolders.some((f) => inFolder(path, f));
  }

  // (re)index one note; returns whether the index changed
  private async indexFile(file: TFile, scope: IndexScope): Promise<boolean> {
    const cache = this.app.metadataCache.getFileCache(file);
    if (inFolder(file.path, scope.projectsFolder)) {
      const content = await this.app.vault.cachedRead(file);
      const project = parseProject(file.path, content, cache?.frontmatter);
      if (project) {
        this.projects.set(file.path, project);
        return true;
      }
      // a non-project note in the projects folder is only an inbox in vault mode
      if (scope.mode === "single") return this.projects.delete(file.path);
    }
    // skip notes the metadata cache says hold no tasks, without reading them
    if (scope.mode === "vault" && cache && !cache.listItems?.some((li) => li.task !== undefined)) {
      return this.projects.delete(file.path);
    }
    const content = await this.app.vault.cachedRead(file);
    const tasks: Task[] = [];
    content.split("\n").forEach((line, i) => {
      const t = parseTaskLine(line, i);
      if (t) tasks.push({ ...t, path: file.path });
    });
    if (tasks.length === 0) return this.projects.delete(file.path);
    this.projects.set(file.path, {
      path: file.path,
      name: scope.mode === "single" ? "Inbox" : file.basename,
      kind: "inbox",
      status: "active",
      flow: "parallel",
      tasks,
    });
    return true;
  }
}
