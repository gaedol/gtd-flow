import { describe, it, expect, afterEach } from "vitest";
import { availableTasks, isWaitingFor, waitingOn, waitingFor, forecast, setWaitTag } from "../src/engine";
import { parseProject, parseTaskLine } from "../src/parser";
import { serializeTask } from "../src/serialize";
import { stalledState } from "../src/stalled";
import { setWaitingLine, clearWaitingLine, toggleTagLine, waitTagFor } from "../src/taskWrite";
import { Project } from "../src/types";

const TODAY = "2026-10-22";

const proj = (name: string, body: string, fm: Record<string, unknown> = {}): Project =>
  parseProject(`GTD/Projects/${name}.md`, body, { type: "project", ...fm })!;

afterEach(() => setWaitTag("wait"));

describe("parsing", () => {
  it("reads ➕ as the created date and strips it from the text", () => {
    const t = parseTaskLine("- [ ] quote from Anna #wait/anna ➕ 2026-10-01", 0)!;
    expect(t.created).toBe("2026-10-01");
    expect(t.text).toBe("quote from Anna");
  });

  it("keeps accented letters in tags", () => {
    expect(parseTaskLine("- [ ] call #wait/Nicolò", 0)!.tags).toEqual(["wait/Nicolò"]);
  });

  it("round-trips ➕ through serialize", () => {
    const line = "- [ ] quote #wait/anna ➕ 2026-10-01 🛫 2026-10-29";
    const t = parseTaskLine(line, 0)!;
    const again = parseTaskLine(serializeTask(t), 0)!;
    expect(again.created).toBe("2026-10-01");
    expect(again.defer).toBe("2026-10-29");
    expect(again.tags).toEqual(["wait/anna"]);
  });
});

describe("who", () => {
  it("is the tag's sub-level, or empty for a bare tag", () => {
    expect(waitingOn(parseTaskLine("- [ ] a #wait/anna", 0)!)).toBe("anna");
    expect(waitingOn(parseTaskLine("- [ ] a #wait", 0)!)).toBe("");
  });

  it("follows the configured tag and ignores look-alikes", () => {
    expect(isWaitingFor(parseTaskLine("- [ ] a #waiting", 0)!)).toBe(false);
    setWaitTag("delegated");
    expect(isWaitingFor(parseTaskLine("- [ ] a #delegated/bob", 0)!)).toBe(true);
    expect(isWaitingFor(parseTaskLine("- [ ] a #wait/bob", 0)!)).toBe(false);
  });
});

describe("availability", () => {
  it("a waiting task is not a next action", () => {
    const p = proj("P", "- [ ] quote #wait/anna\n- [ ] other");
    expect(availableTasks(p, TODAY).map((t) => t.text)).toEqual(["other"]);
  });

  it("in a sequential project it holds up what follows", () => {
    const p = proj("P", "- [ ] quote #wait/anna\n- [ ] sign contract", { flow: "sequential" });
    expect(availableTasks(p, TODAY)).toEqual([]);
  });

  it("a project with only waiting work is stalled on others", () => {
    const p = proj("P", "- [ ] quote #wait/anna 🛫 2026-12-01\n- [ ] sign", { flow: "sequential" });
    expect(stalledState(p, TODAY)).toMatchObject({ kind: "waiting-for", reason: "waiting on others" });
  });
});

describe("waitingFor list", () => {
  const p = proj(
    "P",
    [
      "- [ ] old #wait/bob ➕ 2026-09-01",
      "- [ ] fresh #wait/anna ➕ 2026-10-20",
      "- [ ] chase #wait/carla ➕ 2026-10-10 🛫 2026-10-21",
      "- [ ] later chase #wait ➕ 2026-10-15 🛫 2026-11-01",
      "- [x] answered #wait/dan ✅ 2026-10-20",
      "- [ ] parked #wait/eve #someday",
      "- [ ] not waiting",
    ].join("\n")
  );

  it("puts nudges first, then the longest-waiting", () => {
    expect(waitingFor([p], TODAY).map((i) => i.task.text)).toEqual(["chase", "old", "later chase", "fresh"]);
  });

  it("reports who, since and whether to chase", () => {
    const [chase] = waitingFor([p], TODAY);
    expect(chase).toMatchObject({ who: "carla", since: "2026-10-10", followUp: "2026-10-21", nudge: true });
  });

  it("skips inactive projects", () => {
    expect(waitingFor([{ ...p, status: "on-hold" }], TODAY)).toEqual([]);
  });

  it("shows the follow-up date in the forecast as a follow-up", () => {
    const items = forecast([p], TODAY, 14);
    const later = items.find((i) => i.task.text === "later chase")!;
    expect(later).toMatchObject({ date: "2026-11-01", followUp: true });
  });
});

describe("line writes", () => {
  it("tags, sets the follow-up and stamps ➕", () => {
    expect(setWaitingLine("- [ ] quote", "wait", "Anna Rossi", "2026-10-29", TODAY)).toBe(
      "- [ ] quote #wait/Anna-Rossi 🛫 2026-10-29 ➕ 2026-10-22"
    );
  });

  it("replaces the person and date but keeps the original ➕", () => {
    const raw = "- [ ] quote #wait/anna 🛫 2026-10-25 ➕ 2026-10-01 #home";
    expect(setWaitingLine(raw, "wait", "bob", undefined, TODAY)).toBe("- [ ] quote ➕ 2026-10-01 #home #wait/bob");
  });

  it("keeps a block id last", () => {
    expect(setWaitingLine("- [ ] quote ^gtd-ab12", "wait", "", undefined, TODAY)).toBe(
      "- [ ] quote #wait ➕ 2026-10-22 ^gtd-ab12"
    );
  });

  it("clearing drops the tag and follow-up, not other tags", () => {
    expect(clearWaitingLine("- [ ] quote #wait/anna #waiting-room 🛫 2026-10-29 ➕ 2026-10-01", "wait")).toBe(
      "- [ ] quote #waiting-room ➕ 2026-10-01"
    );
  });

  it("toggling a tag off leaves its sub-tags and longer tags alone", () => {
    expect(toggleTagLine("- [ ] a #someday #someday/maybe #somedays", ["someday", "someday/maybe", "somedays"], "someday")).toBe(
      "- [ ] a #someday/maybe #somedays"
    );
  });

  it("turns names into tag-safe levels", () => {
    expect(waitTagFor("wait", "  Nicolò  d'Este ")).toBe("wait/Nicolò-dEste");
    expect(waitTagFor("wait", "")).toBe("wait");
  });
});
