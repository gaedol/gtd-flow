import { Project } from "./types";
import { availableTasks, isDueForReview } from "./engine";

const OPEN = "%% gtd:status %%";
const CLOSE = "%% /gtd:status %%";
const BLOCK_RE = /%% gtd:status %%[\s\S]*?%% \/gtd:status %%/;

function progressBar(done: number, total: number): string {
  if (total === 0) return "—";
  const filled = Math.round((done / total) * 10);
  return "▓".repeat(filled) + "░".repeat(10 - filled);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

// the inner markdown of the status block (between the comment markers)
export function statusBlockText(p: Project, today: string): string {
  const open = p.tasks.filter((t) => !t.done);
  const total = p.tasks.length;
  const resolved = total - open.length;
  const avail = availableTasks(p, today);

  let next: string;
  if (open.length === 0) next = "_(no open tasks)_";
  else if (avail.length === 0) next = p.status === "active" ? "_(stalled — nothing available)_" : `_(${p.status})_`;
  else next = avail[0].text;

  const lines = [
    `**Next action:** ${next}`,
    `**Progress:** ${progressBar(resolved, total)} ${resolved}/${total} · ${avail.length} available`,
  ];
  if (p.reviewInterval) {
    const ago = p.lastReviewed ? `last reviewed ${daysBetween(p.lastReviewed, today)}d ago` : "never reviewed";
    lines.push(`**Review:** ${isDueForReview(p, today) ? "due" : "ok"} (${ago})`);
  }
  return lines.join("\n");
}

// replace the block's contents, or insert it after frontmatter; idempotent
export function upsertStatusBlock(
  content: string,
  inner: string,
  insertIfMissing: boolean
): { content: string; changed: boolean } {
  const block = `${OPEN}\n${inner}\n${CLOSE}`;
  if (BLOCK_RE.test(content)) {
    const updated = content.replace(BLOCK_RE, block);
    return { content: updated, changed: updated !== content };
  }
  if (!insertIfMissing) return { content, changed: false };
  const fm = content.match(/^---\n[\s\S]*?\n---\n?/);
  if (fm) {
    const idx = fm[0].length;
    return { content: content.slice(0, idx) + "\n" + block + "\n" + content.slice(idx), changed: true };
  }
  return { content: `${block}\n\n${content}`, changed: true };
}

export function hasStatusBlock(content: string): boolean {
  return BLOCK_RE.test(content);
}
