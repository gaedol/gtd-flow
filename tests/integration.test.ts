import { describe, it, expect } from "vitest";
import { parseProject } from "../src/parser";
import { availableTasks, forecast } from "../src/engine";
import { taskContainers, projectNotes, inboxTasks } from "../src/selectors";
import { DEFAULT_PERSPECTIVES, runPerspective } from "../src/perspectives";
import { defaultSort, applyManualOrder } from "../src/ordering";
import { parseDoneQuery, resolveRange, collectDone } from "../src/doneQuery";
import { stalledState, attentionReason } from "../src/stalled";
import { completeLine } from "../src/taskWrite";
import { archiveDoneTasks } from "../src/archive";
import { DEFAULT_SETTINGS } from "../src/settingsData";
import { Project } from "../src/types";

const TODAY = "2026-07-25";
const INBOX = "GTD/Inbox.md";

// a small vault: one working project, one sequential one, one finished, one
// stalled, plus the inbox as the synthesized pseudo-project
function vault(): Project[] {
  const kitchen = parseProject(
    "GTD/Projects/Home/Kitchen.md",
    [
      "- [ ] order tiles #home 📅 2026-07-26",
      "- [x] measure wall ✅ 2026-07-20",
      "- [ ] later #someday",
    ].join("\n"),
    { type: "project" }
  )!;
  const launch = parseProject(
    "GTD/Projects/Work/Launch.md",
    ["- [ ] write copy #work", "- [ ] publish #work 📅 2026-07-27"].join("\n"),
    { type: "project", flow: "sequential" }
  )!;
  const finished = parseProject(
    "GTD/Projects/Work/Old.md",
    "- [x] shipped ✅ 2026-07-10",
    { type: "project", status: "completed" }
  )!;
  const stalled = parseProject(
    "GTD/Projects/Home/Garage.md",
    "- [x] everything ✅ 2026-02-01",
    { type: "project" }
  )!;
  const inbox: Project = {
    path: INBOX,
    name: "Inbox",
    status: "active",
    flow: "parallel",
    tasks: parseProject(INBOX, "- [ ] call plumber 📅 2026-07-25", { type: "project" })!.tasks,
  };
  return [kitchen, launch, finished, stalled, inbox];
}

describe("selectors over a realistic vault", () => {
  const snapshot = vault();

  it("project surfaces exclude the inbox, date surfaces include it", () => {
    expect(projectNotes(snapshot, INBOX).map((p) => p.name)).toEqual(["Kitchen", "Launch", "Old", "Garage"]);
    expect(taskContainers(snapshot).length).toBe(5);
  });

  it("the inbox section sees only its open tasks", () => {
    expect(inboxTasks(snapshot, INBOX).map((t) => t.text)).toEqual(["call plumber"]);
  });
});

describe("next actions pipeline", () => {
  it("offers one action per project, respecting flow and parking", () => {
    const byProject = projectNotes(vault(), INBOX)
      .map((p) => [p.name, availableTasks(p, TODAY).map((t) => t.text)] as const)
      .filter(([, t]) => t.length > 0);
    expect(byProject).toEqual([
      ["Kitchen", ["order tiles"]], // #someday parked, done one gone
      ["Launch", ["write copy"]], // sequential: only the head
    ]);
  });

  it("completing the head of a sequential project frees the next one", () => {
    const doc = ["- [ ] write copy #work", "- [ ] publish #work"].join("\n");
    const lines = doc.split("\n");
    lines[0] = completeLine(lines[0], TODAY).line;
    const after = parseProject("p.md", lines.join("\n"), { type: "project", flow: "sequential" })!;
    expect(availableTasks(after, TODAY).map((t) => t.text)).toEqual(["publish"]);
  });
});

describe("forecast pipeline with ordering", () => {
  it("groups by day, includes the inbox, and honours a saved order", () => {
    const items = forecast(taskContainers(vault()), TODAY, 7);
    const todays = items.filter((i) => i.date === TODAY);
    expect(todays.map((i) => i.task.text)).toContain("call plumber");

    const sorted = defaultSort(todays, TODAY, "flag");
    const keys = sorted.map((i) => i.task.blockId ?? i.task.text);
    const reversed = applyManualOrder(sorted, [...keys].reverse());
    expect(reversed.length).toBe(sorted.length);
  });
});

describe("every built-in perspective runs", () => {
  it("produces a usable grouping without throwing", () => {
    for (const p of DEFAULT_PERSPECTIVES) {
      const groups = runPerspective(taskContainers(vault()), p, TODAY, "flag", "important");
      expect(groups, p.name).toBeInstanceOf(Map);
      for (const [key, items] of groups) {
        expect(key.length, `${p.name} group key`).toBeGreaterThan(0);
        expect(items.length, `${p.name} / ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("has unique names, since the view selects by name", () => {
    const names = DEFAULT_PERSPECTIVES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("the Done perspective finds closed work, the others do not", () => {
    const snapshot = taskContainers(vault());
    const done = DEFAULT_PERSPECTIVES.find((p) => p.done)!;
    const texts = [...runPerspective(snapshot, done, TODAY, "flag").values()].flat().map((i) => i.task.text);
    expect(texts).toContain("shipped");
    const flagged = DEFAULT_PERSPECTIVES.find((p) => p.flagged)!;
    expect([...runPerspective(snapshot, flagged, TODAY, "flag").values()].flat()).toEqual([]);
  });
});

describe("done queries over the same vault", () => {
  it("find closed tasks across project statuses within the window", () => {
    const q = parseDoneQuery("range: last-30-days");
    const entries = collectDone(projectNotes(vault(), INBOX), resolveRange(q, TODAY), q);
    expect(entries.map((e) => e.task.text)).toEqual(["measure wall", "shipped"]);
  });

  it("a project filter narrows to one note", () => {
    const q = parseDoneQuery("range: all\nproject: kitchen");
    const entries = collectDone(projectNotes(vault(), INBOX), resolveRange(q, TODAY), q);
    expect(entries.map((e) => e.project.name)).toEqual(["Kitchen"]);
  });
});

describe("stalled detection over the same vault", () => {
  it("flags the project whose tasks are all closed, and only that one", () => {
    const flagged = projectNotes(vault(), INBOX)
      .filter((p) => stalledState(p, TODAY))
      .map((p) => p.name);
    expect(flagged).toEqual(["Garage"]);
  });

  it("reports staleness for an idle project once it is past the window", () => {
    const garage = projectNotes(vault(), INBOX).find((p) => p.name === "Garage")!;
    expect(attentionReason(garage, TODAY, 30)).toContain("every task closed");
    const kitchen = projectNotes(vault(), INBOX).find((p) => p.name === "Kitchen")!;
    expect(attentionReason(kitchen, TODAY, 30)).toBeNull(); // closed something 5 days ago
    expect(attentionReason(kitchen, TODAY, 3)).toBe("no progress in 5 days");
  });
});

describe("archive round-trip through the parser", () => {
  it("leaves the note parseable with the open tasks intact", () => {
    const doc = ["- [ ] open #home", "- [x] shut ✅ 2026-01-01"].join("\n");
    const { content, moved } = archiveDoneTasks(doc, TODAY, 7);
    expect(moved).toBe(1);
    const reparsed = parseProject("p.md", content, { type: "project" })!;
    expect(reparsed.tasks.map((t) => t.text)).toEqual(["open", "shut"]);
    expect(availableTasks(reparsed, TODAY).map((t) => t.text)).toEqual(["open"]);
  });
});

describe("default settings", () => {
  it("ship the keys the features depend on, with sane values", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      flagTag: "flag",
      importantTag: "important",
      somedayTag: "someday",
      stalledTag: "stalled",
      projectSort: "alpha",
      insertPosition: "bottom",
      handleEditorClicks: true,
      clickCycles: false,
      autoMarkStalled: false,
    });
    expect(DEFAULT_SETTINGS.forecastDays).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.staleAfterDays).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.perspectives).toBe(DEFAULT_PERSPECTIVES);
  });

  it("keeps the tag defaults distinct, so icons and filters don't collide", () => {
    const tags = [
      DEFAULT_SETTINGS.flagTag,
      DEFAULT_SETTINGS.importantTag,
      DEFAULT_SETTINGS.somedayTag,
      DEFAULT_SETTINGS.stalledTag,
    ];
    expect(new Set(tags).size).toBe(tags.length);
  });
});
