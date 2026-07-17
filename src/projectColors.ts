import { App } from "obsidian";

// shape stored by the "Color Folders and Files" plugin (color-folders-files)
export interface FolderStyle {
  backgroundColor?: string;
  textColor?: string;
  isBold?: boolean;
  isItalic?: boolean;
  opacity?: number;
  applyToSubfolders?: boolean;
  applyToFiles?: boolean;
}

type StyleMap = Record<string, FolderStyle>;

interface ColorPluginHost {
  plugins?: { plugins?: Record<string, { settings?: { styles?: StyleMap } } | undefined> };
}

export function explorerStyles(app: App): StyleMap | null {
  const host = app as unknown as ColorPluginHost;
  return host.plugins?.plugins?.["color-folders-files"]?.settings?.styles ?? null;
}

// effective style for a file path, mirroring the explorer plugin's semantics:
// exact path wins; else the nearest ancestor folder whose style reaches files
// (direct parent needs applyToFiles; deeper ancestors also need applyToSubfolders)
export function resolveStyle(styles: StyleMap, path: string): FolderStyle | null {
  if (styles[path]) return styles[path];
  const parts = path.split("/").slice(0, -1);
  for (let depth = parts.length; depth >= 1; depth--) {
    const folder = parts.slice(0, depth).join("/");
    const s = styles[folder];
    if (!s) continue;
    const direct = depth === parts.length;
    if (s.applyToFiles && (direct || s.applyToSubfolders)) return s;
  }
  return null;
}

// apply a resolved style to an element as an explorer-like pill
export function applyPill(el: HTMLElement, s: FolderStyle): void {
  el.addClass("gtd-pill");
  const styles: Partial<CSSStyleDeclaration> = {};
  if (s.backgroundColor) styles.backgroundColor = s.backgroundColor;
  if (s.textColor) styles.color = s.textColor;
  if (s.isBold) styles.fontWeight = "600";
  if (s.isItalic) styles.fontStyle = "italic";
  if (s.opacity !== undefined) styles.opacity = String(s.opacity);
  el.setCssStyles(styles);
}
