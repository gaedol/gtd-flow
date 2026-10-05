import { Perspective, DEFAULT_PERSPECTIVES } from "./perspectives";
import { InsertPosition } from "./insertLine";

export interface GtdSettings {
  projectsFolder: string;
  inboxNote: string;
  forecastDays: number;
  flagTag: string;
  importantTag: string;
  somedayTag: string;
  stalledTag: string;
  staleAfterDays: number;
  autoMarkStalled: boolean;
  archiveAfterDays: number;
  archiveFolder: string;
  perspectives: Perspective[];
  dayStart: string;
  dayEnd: string;
  defaultDurationMin: number;
  insertPosition: InsertPosition;
  defaultReviewInterval: string;
  dueNotifications: boolean;
  statusBlockChart: boolean;
  promptDropReason: boolean;
  explorerColors: boolean;
  handleEditorClicks: boolean;
  clickCycles: boolean;
  projectSort: "alpha" | "folder" | "manual";
  projectOrder: string[]; // project paths in manual order
  forecastOrder: Record<string, string[]>; // dateKey -> block ids in manual order
  perspectiveOrder: Record<string, string[]>; // perspective+group key -> block ids
}

export const DEFAULT_SETTINGS: GtdSettings = {
  projectsFolder: "GTD/Projects",
  inboxNote: "GTD/Inbox.md",
  forecastDays: 7,
  flagTag: "flag",
  importantTag: "important",
  somedayTag: "someday",
  stalledTag: "stalled",
  staleAfterDays: 30,
  autoMarkStalled: false,
  archiveAfterDays: 7,
  archiveFolder: "GTD/Archive",
  perspectives: DEFAULT_PERSPECTIVES,
  dayStart: "09:00",
  dayEnd: "22:00",
  defaultDurationMin: 30,
  insertPosition: "bottom",
  defaultReviewInterval: "1w",
  dueNotifications: true,
  statusBlockChart: false,
  promptDropReason: true,
  explorerColors: true,
  handleEditorClicks: true,
  clickCycles: false,
  projectSort: "alpha",
  projectOrder: [],
  forecastOrder: {},
  perspectiveOrder: {},
};
