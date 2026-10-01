import { App, TFile, moment, normalizePath } from "obsidian";
import { DailyNoteConfig, DEFAULT_DAILY_FORMAT, dailyNotePath, expandDailyTemplate } from "./dailyNoteFormat";

// Obsidian doesn't expose core plugin settings publicly; read them where the
// app keeps them, falling back to core's defaults when they're missing
interface InternalPlugins {
  internalPlugins?: {
    plugins?: Record<string, { instance?: { options?: Record<string, unknown> } } | undefined>;
  };
}

function coreOptions(app: App, id: string): Record<string, unknown> {
  return (app as unknown as InternalPlugins).internalPlugins?.plugins?.[id]?.instance?.options ?? {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function dailyNoteConfig(app: App): DailyNoteConfig {
  const o = coreOptions(app, "daily-notes");
  return { folder: str(o["folder"]), format: str(o["format"]) || DEFAULT_DAILY_FORMAT, template: str(o["template"]) };
}

// core Templates folder, so template checklists aren't indexed as inbox tasks
export function templatesFolder(app: App): string {
  return str(coreOptions(app, "templates")["folder"]).trim();
}

async function ensureFolder(app: App, dir: string) {
  let path = "";
  for (const part of dir.split("/").filter(Boolean)) {
    path = path ? `${path}/${part}` : part;
    if (!app.vault.getFolderByPath(path)) await app.vault.createFolder(path);
  }
}

// today's daily note, created (from the daily-note template) if missing
export async function ensureTodayNote(app: App): Promise<TFile> {
  const cfg = dailyNoteConfig(app);
  // obsidian's typings export moment's namespace, not its callable default
  const now = (moment as unknown as () => { format(f: string): string })();
  const fmt = (f: string) => now.format(f);
  const path = normalizePath(dailyNotePath(cfg, fmt));
  const existing = app.vault.getFileByPath(path);
  if (existing) return existing;

  let content = "";
  if (cfg.template.trim()) {
    const tplPath = normalizePath(cfg.template.trim().replace(/(\.md)?$/, ".md"));
    const tpl = app.vault.getFileByPath(tplPath);
    if (tpl) {
      const title = path.replace(/.*\//, "").replace(/\.md$/, "");
      content = expandDailyTemplate(await app.vault.cachedRead(tpl), title, cfg.format, fmt);
    }
  }
  const dir = path.includes("/") ? path.replace(/\/[^/]*$/, "") : "";
  if (dir) await ensureFolder(app, dir);
  return app.vault.create(path, content);
}
