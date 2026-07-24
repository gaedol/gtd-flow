import { App, TFile, Events } from "obsidian";
import { Project, Task } from "./types";
import { parseProject, parseTaskLine } from "./parser";

// In-memory project index; markdown stays the source of truth
export class TaskIndex extends Events {
  // single source of truth: real project notes plus the inbox, held as a
  // synthesized "Inbox" project under its own path. get()/all() hide the inbox
  // so project-note logic is unaffected; selectors decide per-surface inclusion.
  private projects = new Map<string, Project>();

  constructor(
    private app: App,
    private folder: () => string,
    private inboxPath: () => string
  ) {
    super();
  }

  // raw set of every indexed container (real projects + the inbox pseudo-
  // project); use the selectors in selectors.ts to pick per surface
  snapshot(): Project[] {
    return [...this.projects.values()];
  }

  // the configured inbox note path, so selectors can identify the inbox entry
  inboxNotePath(): string {
    return this.inboxPath();
  }

  get(path: string): Project | undefined {
    if (path === this.inboxPath()) return undefined; // inbox isn't a project note
    return this.projects.get(path);
  }

  async rebuild(): Promise<void> {
    this.projects.clear();
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.inScope(f));
    await Promise.all(files.map((f) => this.indexFile(f)));
    this.trigger("changed");
  }

  async update(file: TFile): Promise<void> {
    if (!this.inScope(file)) return;
    await this.indexFile(file);
    this.trigger("changed");
  }

  remove(path: string): void {
    if (this.projects.delete(path)) this.trigger("changed");
  }

  private inScope(file: TFile): boolean {
    if (file.extension !== "md") return false;
    return file.path.startsWith(this.folder() + "/") || file.path === this.inboxPath();
  }

  private async indexFile(file: TFile): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    if (file.path === this.inboxPath()) {
      const tasks: Task[] = [];
      content.split("\n").forEach((line, i) => {
        const t = parseTaskLine(line, i);
        if (t) tasks.push(t);
      });
      this.projects.set(file.path, {
        path: file.path,
        name: "Inbox",
        status: "active",
        flow: "parallel",
        tasks,
      });
      return;
    }
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const project = parseProject(file.path, content, fm);
    if (project) this.projects.set(file.path, project);
    else this.projects.delete(file.path);
  }
}
