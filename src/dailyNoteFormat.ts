// Pure helpers for daily-note paths and templates. Date formatting is passed
// in (moment in the plugin) so these stay testable without Obsidian.

export type DateFormatter = (format: string) => string;

export interface DailyNoteConfig {
  folder: string;
  format: string; // moment format; may contain "/" for nested folders
  template: string; // vault path to a template note, extension optional
}

export const DEFAULT_DAILY_FORMAT = "YYYY-MM-DD";

export function dailyNotePath(cfg: DailyNoteConfig, fmt: DateFormatter): string {
  const folder = cfg.folder.trim().replace(/^\/+|\/+$/g, "");
  const name = fmt(cfg.format.trim() || DEFAULT_DAILY_FORMAT);
  return (folder ? folder + "/" : "") + name + ".md";
}

// Expand the variables core Daily Notes supports: {{title}}, {{date}},
// {{time}}, and {{date:FORMAT}} / {{time:FORMAT}}
export function expandDailyTemplate(template: string, title: string, dateFormat: string, fmt: DateFormatter): string {
  return template
    .replace(/{{\s*title\s*}}/gi, title)
    .replace(/{{\s*(date|time)\s*(?::([^}]*))?}}/gi, (_: string, kind: string, custom?: string) => {
      const f = custom?.trim() || (kind.toLowerCase() === "date" ? dateFormat || DEFAULT_DAILY_FORMAT : "HH:mm");
      return fmt(f);
    });
}
