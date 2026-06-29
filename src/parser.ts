import { Task, Project, ProjectStatus, ProjectFlow } from "./types";

const TASK_RE = /^(\s*)[-*] \[(.)\] (.*)$/;
const DEFER_RE = /🛫 *(\d{4}-\d{2}-\d{2})/u;
const SCHEDULED_RE = /⏳ *(\d{4}-\d{2}-\d{2})/u;
const DUE_RE = /📅 *(\d{4}-\d{2}-\d{2})/u;
const DONE_RE = /✅ *(\d{4}-\d{2}-\d{2})/u;
const CANCELLED_RE = /❌ *(\d{4}-\d{2}-\d{2})/u;
const REPEAT_RE = /🔁 *([^🛫📅✅❌⏳➕🔺⏫🔼🔽⏬⏱⏰#]*)/u;
const DURATION_RE = /⏱ *(?:(\d+)h)? *(?:(\d+)m)?/u;
const TIME_RE = /⏰ *(\d{1,2}:\d{2})/u;
const TAG_RE = /#([\w/-]+)/gu;
const BLOCK_ID_RE = /\s\^([A-Za-z0-9-]+)\s*$/;

export function parseTaskLine(line: string, lineNo: number): Task | null {
  const m = line.match(TASK_RE);
  if (!m) return null;
  const body = m[3];
  const ch = m[2];
  const task: Task = {
    // "-" dropped and "x"/"X" done are both resolved (out of the active flow)
    text: stripMetadata(body),
    done: ch === "x" || ch === "X" || ch === "-",
    line: lineNo,
    indent: m[1].length,
    tags: [...body.matchAll(TAG_RE)].map((t) => t[1]),
  };
  if (ch === "-") task.dropped = true;
  if (ch === "/") task.inProgress = true;
  // Tasks-plugin ⏳ scheduled acts as defer when there is no explicit 🛫 start
  task.defer = body.match(DEFER_RE)?.[1] ?? body.match(SCHEDULED_RE)?.[1];
  task.due = body.match(DUE_RE)?.[1];
  task.completedOn = body.match(DONE_RE)?.[1];
  task.cancelledOn = body.match(CANCELLED_RE)?.[1];
  const rep = body.match(REPEAT_RE)?.[1].trim();
  if (rep) task.repeat = rep;
  const dur = body.match(DURATION_RE);
  if (dur && (dur[1] || dur[2])) {
    task.durationMin = (parseInt(dur[1] ?? "0", 10) * 60) + parseInt(dur[2] ?? "0", 10);
  }
  const tm = body.match(TIME_RE)?.[1];
  if (tm) task.startTime = tm.padStart(5, "0");
  task.blockId = body.match(BLOCK_ID_RE)?.[1];
  return task;
}

function stripMetadata(body: string): string {
  return body
    .replace(/[🛫📅✅❌⏳➕] *\d{4}-\d{2}-\d{2}/gu, "")
    .replace(REPEAT_RE, "")
    .replace(/[🔺⏫🔼🔽⏬]/gu, "")
    .replace(/⏱ *(?:\d+h)? *(?:\d+m)?/gu, "")
    .replace(/⏰ *\d{1,2}:\d{2}/gu, "")
    .replace(BLOCK_ID_RE, "")
    .replace(TAG_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Frontmatter {
  [key: string]: unknown;
}

export function parseProject(
  path: string,
  content: string,
  frontmatter: Frontmatter | undefined
): Project | null {
  if (frontmatter?.["type"] !== "project") return null;
  const tasks: Task[] = [];
  content.split("\n").forEach((line, i) => {
    const t = parseTaskLine(line, i);
    if (t) tasks.push(t);
  });
  return {
    path,
    name: path.replace(/.*\//, "").replace(/\.md$/, ""),
    status: asStatus(frontmatter["status"]),
    flow: asFlow(frontmatter["flow"]),
    reviewInterval: asString(frontmatter["review-interval"]),
    lastReviewed: asString(frontmatter["last-reviewed"]),
    color: asString(frontmatter["color"]),
    banner: asString(frontmatter["banner"]),
    tasks,
  };
}

function asStatus(v: unknown): ProjectStatus {
  return v === "on-hold" || v === "someday" || v === "completed" || v === "dropped" ? v : "active";
}

function asFlow(v: unknown): ProjectFlow {
  return v === "sequential" ? "sequential" : "parallel";
}

function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
