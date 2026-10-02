import { App, CachedMetadata, TFile, Events, getLinkpath } from "obsidian";
import { Project } from "./types";
import { applyFileDate, parseNoteTasks, parseProject } from "./parser";
import { assemble, BrokenLink, NoteRecord } from "./projectAssembly";

// What the index covers. "vault": every note outside the ignored folders —
// project notes are projects, any other note with tasks is an inbox.
// "single": the projects folder plus one configured inbox note.
// In both modes a note anywhere in scope can join a project as a member by
// linking to its hub in `project:` frontmatter.
export interface IndexScope {
  mode: "vault" | "single";
  projectsFolder: string;
  inboxNote: string;
  ignoredFolders: string[];
  inferDueFromFileName: boolean;
}

const MEMBER_KEY = "project";

function inFolder(path: string, folder: string): boolean {
  return !!folder && path.startsWith(folder + "/");
}

// the `project:` value of a note: a frontmatter link (explicit), or plain text
// that may still name a hub
export function memberLink(cache: CachedMetadata | null): { link: string; explicit: boolean } | null {
  const fl = cache?.frontmatterLinks?.find((l) => l.key === MEMBER_KEY);
  if (fl) return { link: getLinkpath(fl.link), explicit: true };
  const v = cache?.frontmatter?.[MEMBER_KEY];
  return typeof v === "string" && v.trim() ? { link: v.trim(), explicit: false } : null;
}

// In-memory project index; markdown stays the source of truth
export class TaskIndex extends Events {
  // per-note records, joined into projects by assemble() after every change:
  // hubs gain their members' tasks, everything else with tasks is an inbox
  // note (kind "inbox"). get() hides inbox notes so project-note logic is
  // unaffected; selectors decide per-surface inclusion.
  private notes = new Map<string, NoteRecord>();
  private projects = new Map<string, Project>();
  private hubOf = new Map<string, string>();
  private broken: BrokenLink[] = [];

  constructor(
    private app: App,
    private scope: () => IndexScope
  ) {
    super();
  }

  // raw set of every indexed container (projects + inbox notes); use the
  // selectors in selectors.ts to pick per surface
  snapshot(): Project[] {
    return [...this.projects.values()];
  }

  // the project a note belongs to: its hub, or the project it's a member of
  // (inbox notes aren't projects)
  get(path: string): Project | undefined {
    const p = this.projects.get(this.hubOf.get(path) ?? path);
    return p?.kind === "inbox" ? undefined : p;
  }

  // any indexed note: a project hub, a member, or an inbox note
  has(path: string): boolean {
    return this.projects.has(path) || this.hubOf.has(path);
  }

  // member notes whose `project:` link doesn't reach a project
  brokenLinks(): BrokenLink[] {
    return this.broken;
  }

  // whether a note at this path falls inside the index's scope, whether or
  // not it holds tasks yet
  covers(path: string): boolean {
    const scope = this.scope();
    return this.pathInScope(path, scope) || this.singleModeMember(path, this.app.metadataCache.getCache(path), scope);
  }

  async rebuild(): Promise<void> {
    this.notes.clear();
    const scope = this.scope();
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.inScope(f, scope));
    await Promise.all(files.map((f) => this.indexFile(f, scope)));
    this.reassemble();
    this.trigger("changed");
  }

  async update(file: TFile): Promise<void> {
    const scope = this.scope();
    // a note can also leave the scope (e.g. drop its `project:` link in single mode)
    const changed = this.inScope(file, scope) ? await this.indexFile(file, scope) : this.notes.delete(file.path);
    // only re-render when the index actually changed: in vault mode most
    // edits land in notes without tasks
    if (!changed) return;
    this.reassemble();
    this.trigger("changed");
  }

  remove(path: string): void {
    if (!this.notes.delete(path)) return;
    this.reassemble();
    this.trigger("changed");
  }

  private reassemble() {
    const a = assemble(this.notes, (link, from) => this.app.metadataCache.getFirstLinkpathDest(link, from)?.path ?? null);
    this.projects = a.projects;
    this.hubOf = a.hubOf;
    this.broken = a.broken;
  }

  private inScope(file: TFile, scope: IndexScope): boolean {
    if (file.extension !== "md") return false;
    return this.pathInScope(file.path, scope) || this.singleModeMember(file.path, this.app.metadataCache.getFileCache(file), scope);
  }

  // single mode only indexes the projects folder and inbox, plus member notes
  // anywhere outside the ignored folders (the archive among them)
  private singleModeMember(path: string, cache: CachedMetadata | null, scope: IndexScope): boolean {
    if (scope.mode !== "single" || scope.ignoredFolders.some((f) => inFolder(path, f))) return false;
    return !!memberLink(cache);
  }

  private pathInScope(path: string, scope: IndexScope): boolean {
    if (scope.mode === "single") {
      return inFolder(path, scope.projectsFolder) || path === scope.inboxNote;
    }
    return !scope.ignoredFolders.some((f) => inFolder(path, f));
  }

  // (re)record one note; returns whether anything changed
  private async indexFile(file: TFile, scope: IndexScope): Promise<boolean> {
    const cache = this.app.metadataCache.getFileCache(file);
    if (inFolder(file.path, scope.projectsFolder)) {
      const content = await this.app.vault.cachedRead(file);
      const project = parseProject(file.path, content, cache?.frontmatter);
      if (project) {
        if (scope.inferDueFromFileName) project.tasks = project.tasks.map((t) => applyFileDate(t, file.path));
        this.notes.set(file.path, { kind: "project", project });
        return true;
      }
    }
    const member = memberLink(cache);
    // skip notes the metadata cache says hold no tasks, without reading them
    // (members are kept even without tasks: they still belong to the project)
    const hasTasks = !cache || !!cache.listItems?.some((li) => li.task !== undefined);
    let tasks = hasTasks ? parseNoteTasks(file.path, await this.app.vault.cachedRead(file)) : [];
    if (scope.inferDueFromFileName) tasks = tasks.map((t) => applyFileDate(t, file.path));
    const isInbox = scope.mode === "vault" || file.path === scope.inboxNote;
    if (member) {
      this.notes.set(file.path, { kind: "member", name: file.basename, ...member, fallbackInbox: isInbox, tasks });
      return true;
    }
    if (!isInbox || tasks.length === 0) return this.notes.delete(file.path);
    this.notes.set(file.path, { kind: "inbox", name: scope.mode === "single" ? "Inbox" : file.basename, tasks });
    return true;
  }
}
