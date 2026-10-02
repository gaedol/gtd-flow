import { describe, it, expect } from "vitest";
import { setCheckboxChar, completeLine, setStateLine, toggleTagLine, withBlockId, triagedLine, editedSystemTags } from "../src/taskWrite";
import { parseTaskLine } from "../src/parser";
import { serializeTask } from "../src/serialize";

const TODAY = "2026-07-24";

describe("setCheckboxChar", () => {
  it("swaps only the status char, keeping metadata and indent", () => {
    expect(setCheckboxChar("  - [ ] task 📅 2026-08-01 #home", "/")).toBe(
      "  - [/] task 📅 2026-08-01 #home"
    );
  });
});

describe("completeLine", () => {
  it("checks the box and stamps ✅ today", () => {
    expect(completeLine("- [ ] tidy up", TODAY)).toEqual({
      line: "- [x] tidy up ✅ 2026-07-24",
      next: null,
    });
  });

  it("returns the next occurrence for a fixed-schedule repeat", () => {
    const r = completeLine("- [ ] water 🔁 every week 📅 2026-07-24", TODAY);
    expect(r.line).toBe("- [x] water 🔁 every week 📅 2026-07-24 ✅ 2026-07-24");
    expect(r.next).toBe("- [ ] water 🔁 every week 📅 2026-07-31");
  });
});

describe("setStateLine", () => {
  it("marks in-progress without adding a date", () => {
    expect(setStateLine("- [ ] draft", "in-progress", TODAY)).toBe("- [/] draft");
  });

  it("drops with a ❌ date and 💬 reason, clearing any prior status date", () => {
    expect(setStateLine("- [x] old ✅ 2026-01-01", "dropped", TODAY, "superseded")).toBe(
      "- [-] old 💬 superseded ❌ 2026-07-24"
    );
  });

  it("reopening removes the status date", () => {
    expect(setStateLine("- [x] done ✅ 2026-01-01", "todo", TODAY)).toBe("- [ ] done");
  });
});

describe("toggleTagLine", () => {
  it("adds a tag when absent and removes it when present", () => {
    expect(toggleTagLine("- [ ] task", [], "important")).toBe("- [ ] task #important");
    expect(toggleTagLine("- [ ] task #important", ["important"], "important")).toBe("- [ ] task");
  });
});

describe("withBlockId", () => {
  it("appends an id once", () => {
    expect(withBlockId("- [ ] call Sam 📅 2026-10-02  ", "gtdab12cd")).toBe("- [ ] call Sam 📅 2026-10-02 ^gtdab12cd");
    expect(withBlockId("- [ ] call Sam ^mine", "gtdab12cd")).toBe("- [ ] call Sam ^mine");
  });
});

describe("triagedLine", () => {
  it("leaves a plain bullet with the text and link, keeping indent", () => {
    expect(triagedLine("    - [ ] call Sam #work", "call Sam", "[[Hiring#^gtdab12cd|Hiring]]")).toBe(
      "    - call Sam → [[Hiring#^gtdab12cd|Hiring]]"
    );
  });
});

describe("edit modal round trip", () => {
  it("keeps inline tags where they were and re-appends only system tags", () => {
    const raw = "- [ ] Ask #alice about the #q3 budget #important #flag 📅 2026-10-20";
    const t = parseTaskLine(raw, 0)!;
    const tags = editedSystemTags(t.tags, { tag: "flag", on: false }, { tag: "someday", on: true });
    expect(tags).toEqual(["important", "someday"]);
    const line = serializeTask({ indent: 0, done: false, text: t.inlineText!, tags, due: t.due });
    expect(line).toBe("- [ ] Ask #alice about the #q3 budget #important #someday 📅 2026-10-20");
  });

  it("removes a tag the user deleted from the text", () => {
    const t = parseTaskLine("- [ ] Ask #alice about it", 0)!;
    const tags = editedSystemTags(t.tags, { tag: "flag", on: false }, { tag: "someday", on: false });
    expect(serializeTask({ indent: 0, done: false, text: "Ask about it", tags })).toBe("- [ ] Ask about it");
  });
});

describe("triagedLine with inline tags", () => {
  it("leaves the user's tags in the back-link bullet", () => {
    const t = parseTaskLine("- [ ] Ask #alice about the budget #flag", 0)!;
    expect(triagedLine("- [ ] x", t.inlineText!, "[[Hiring#^id|Hiring]]")).toBe("- Ask #alice about the budget → [[Hiring#^id|Hiring]]");
  });
});
