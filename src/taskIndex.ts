import { App, TFile, Events } from "obsidian";
import { Project, Task } from "./types";
import { parseProject, parseTaskLine } from "./parser";

// In-memory project index; markdown stays the source of truth
export class TaskIndex extends Events {
  // single source of truth: real project notes plus the inbox, held as a
  // synthesized "Inbox" project under its own path. get()/all() hide the inbox
  // so project-note logic is unaffected; date/urgency views use allWithInbox().
  private projects = new Map<string, Project>();

  constructor(
    private app: App,
    private folder: () => string,
    private inboxPath: () => string
  ) {
    super();
  }

  all(): Project[] {
    const inbox = this.inboxPath();
    return [...this.projects.values()].filter((p) => p.path !== inbox);
  }

  // real projects + the inbox pseudo-project — for Forecast, perspectives, and
  // the overdue badge / notifications, so dated inbox tasks aren't invisible
  allWithInbox(): Project[] {
    return [...this.projects.values()];
  }

  // open inbox tasks, for the Next Actions inbox section
  inboxTasks(): Task[] {
    return this.projects.get(this.inboxPath())?.tasks.filter((t) => !t.done) ?? [];
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
