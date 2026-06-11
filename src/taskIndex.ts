import { App, TFile, Events } from "obsidian";
import { Project, Task } from "./types";
import { parseProject, parseTaskLine } from "./parser";

// In-memory project index; markdown stays the source of truth
export class TaskIndex extends Events {
  private projects = new Map<string, Project>();
  inbox: Task[] = [];

  constructor(
    private app: App,
    private folder: () => string,
    private inboxPath: () => string
  ) {
    super();
  }

  all(): Project[] {
    return [...this.projects.values()];
  }

  get(path: string): Project | undefined {
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
    if (path === this.inboxPath()) {
      this.inbox = [];
      this.trigger("changed");
    } else if (this.projects.delete(path)) {
      this.trigger("changed");
    }
  }

  private inScope(file: TFile): boolean {
    if (file.extension !== "md") return false;
    return file.path.startsWith(this.folder() + "/") || file.path === this.inboxPath();
  }

  private async indexFile(file: TFile): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    if (file.path === this.inboxPath()) {
      this.inbox = [];
      content.split("\n").forEach((line, i) => {
        const t = parseTaskLine(line, i);
        if (t && !t.done) this.inbox.push(t);
      });
      return;
    }
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const project = parseProject(file.path, content, fm);
    if (project) this.projects.set(file.path, project);
    else this.projects.delete(file.path);
  }
}
