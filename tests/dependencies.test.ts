import { describe, it, expect, afterEach } from "vitest";
import { availableTasks, setTaskIds, openBlockers, isWaiting, knownTaskIds, dueSoon, forecast } from "../src/engine";
import { parseProject } from "../src/parser";
import { stalledState } from "../src/stalled";
import { Project } from "../src/types";

const TODAY = "2026-10-16";

const proj = (name: string, body: string, fm: Record<string, unknown> = {}): Project =>
  parseProject(`GTD/Projects/${name}.md`, body, { type: "project", ...fm })!;

// the engine keeps a vault-wide id map; register projects the way the index does
function vault(...ps: Project[]): Project[] {
  setTaskIds(ps);
  return ps;
}

afterEach(() => setTaskIds([]));

describe("dependencies", () => {
  it("a task waiting on an open task in another project is not available", () => {
    const kitchen = proj("Kitchen", "- [ ] order tiles 🆔 tiles");
    const crew = proj("Crew", "- [ ] book the tiler ⛔ tiles");
    vault(kitchen, crew);
    expect(availableTasks(crew, TODAY)).toEqual([]);
    expect(availableTasks(kitchen, TODAY).map((t) => t.text)).toEqual(["order tiles"]);
  });

  it("finishing or dropping the blocker releases the waiting task", () => {
    for (const mark of ["x", "-"]) {
      const kitchen = proj("Kitchen", `- [${mark}] order tiles 🆔 tiles`);
      const crew = proj("Crew", "- [ ] book the tiler ⛔ tiles");
      vault(kitchen, crew);
      expect(availableTasks(crew, TODAY).map((t) => t.text), `blocker [${mark}]`).toEqual(["book the tiler"]);
    }
  });

  it("waits until every listed blocker is done", () => {
    const a = proj("A", "- [x] permit 🆔 permit\n- [ ] beams 🆔 beams");
    const b = proj("B", "- [ ] roof ⛔ permit,beams");
    vault(a, b);
    expect(isWaiting(b.tasks[0])).toBe(true);
    expect(openBlockers(b.tasks[0]).map((t) => t.text)).toEqual(["beams"]);
  });

  it("an id nobody declares does not block, nor does a task naming itself", () => {
    const p = proj("P", "- [ ] typo ⛔ nosuchid\n- [ ] loop 🆔 me ⛔ me");
    vault(p);
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["typo", "loop"]);
  });

  it("in a sequential project a waiting head holds up the rest", () => {
    const other = proj("Other", "- [ ] prerequisite 🆔 pre");
    const seq = proj("Seq", "- [ ] first ⛔ pre\n- [ ] second", { flow: "sequential" });
    vault(other, seq);
    expect(availableTasks(seq, TODAY)).toEqual([]);
  });

  it("a waiting parent holds back its whole subtree", () => {
    const other = proj("Other", "- [ ] prerequisite 🆔 pre");
    const p = proj("P", "- [ ] group ⛔ pre\n    - [ ] child");
    vault(other, p);
    expect(availableTasks(p, TODAY)).toEqual([]);
  });

  it("with duplicate ids, any unfinished holder blocks", () => {
    const a = proj("A", "- [x] old 🆔 dup");
    const b = proj("B", "- [ ] new 🆔 dup");
    const c = proj("C", "- [ ] waits ⛔ dup");
    vault(a, b, c);
    expect(isWaiting(c.tasks[0])).toBe(true);
  });

  it("forecast still lists a waiting task with a deadline, marked unavailable", () => {
    const a = proj("A", "- [ ] prerequisite 🆔 pre");
    const b = proj("B", "- [ ] dated ⛔ pre 📅 2026-10-18");
    vault(a, b);
    const item = forecast([a, b], TODAY, 7).find((i) => i.task.text === "dated")!;
    expect(item.available).toBe(false);
  });

  it("a project whose open work all waits on dependencies is stalled, with that reason", () => {
    const a = proj("A", "- [ ] prerequisite 🆔 pre");
    const b = proj("B", "- [ ] one ⛔ pre\n- [ ] two ⛔ pre");
    vault(a, b);
    const s = stalledState(b, TODAY)!;
    expect(s.kind).toBe("blocked");
    expect(s.reason).toContain("⛔");
  });

  it("lists known ids for the suggester, preferring the open holder", () => {
    vault(proj("A", "- [x] done one 🆔 x\n- [ ] live 🆔 y"));
    const ids = Object.fromEntries(knownTaskIds().map((k) => [k.id, k.task.text]));
    expect(ids).toEqual({ x: "done one", y: "live" });
  });
});

describe("dueSoon", () => {
  const p = proj(
    "P",
    [
      "- [ ] late 📅 2026-10-10",
      "- [ ] today 📅 2026-10-16",
      "- [ ] in two days 📅 2026-10-18",
      "- [ ] edge 📅 2026-10-19",
      "- [ ] beyond 📅 2026-10-20",
      "- [x] closed 📅 2026-10-17",
      "- [ ] parked #someday 📅 2026-10-17",
    ].join("\n")
  );

  it("covers today through the window, excluding late, closed and parked tasks", () => {
    expect(dueSoon([p], TODAY, 3).map((i) => i.task.text)).toEqual(["today", "in two days", "edge"]);
  });

  it("is off at 0 and ignores non-active projects", () => {
    expect(dueSoon([p], TODAY, 0)).toEqual([]);
    const held = proj("H", "- [ ] x 📅 2026-10-17", { status: "on-hold" });
    expect(dueSoon([held], TODAY, 3)).toEqual([]);
  });

  it("includes tasks that are deferred or waiting — a deadline matters either way", () => {
    const a = proj("A", "- [ ] prerequisite 🆔 pre");
    const b = proj("B", "- [ ] blocked ⛔ pre 📅 2026-10-17\n- [ ] later 🛫 2026-11-01 📅 2026-10-18");
    vault(a, b);
    expect(dueSoon([b], TODAY, 3).map((i) => i.task.text)).toEqual(["blocked", "later"]);
  });
});
