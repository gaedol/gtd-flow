import { describe, it, expect } from "vitest";
import { setCheckboxChar, completeLine, setStateLine, toggleTagLine } from "../src/taskWrite";

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

describe("writes keep lines well-formed", () => {
  it("completing replaces a stale ✅ instead of adding a second one", () => {
    const { line } = completeLine("- [ ] reopened ✅ 2026-07-01", TODAY);
    expect(line).toBe("- [x] reopened ✅ 2026-07-24");
  });

  it("collapses an earlier double date", () => {
    expect(setStateLine("- [x] twice ✅ 2026-07-01 ✅ 2026-07-02", "todo", TODAY)).toBe("- [ ] twice");
  });

  it("keeps a ^block-id last, where it still parses", () => {
    expect(completeLine("- [ ] ordered ^gtd-1a", TODAY).line).toBe("- [x] ordered ✅ 2026-07-24 ^gtd-1a");
    expect(setStateLine("- [ ] ordered ^gtd-1a", "dropped", TODAY, "nope")).toBe(
      "- [-] ordered 💬 nope ❌ 2026-07-24 ^gtd-1a"
    );
    expect(toggleTagLine("- [ ] ordered ^gtd-1a", [], "important")).toBe("- [ ] ordered #important ^gtd-1a");
  });

  it("a recurrence is a new task: no block id, no 🆔, no stale date", () => {
    const { next } = completeLine("- [ ] standup 🔁 every day 🆔 su ✅ 2026-07-01 📅 2026-07-24 ^gtd-9", TODAY);
    expect(next).toBe("- [ ] standup 🔁 every day 📅 2026-07-25");
  });

  it("a recurrence keeps what it waits on", () => {
    const { next } = completeLine("- [ ] report ⛔ data 🔁 every week 📅 2026-07-24", TODAY);
    expect(next).toBe("- [ ] report ⛔ data 🔁 every week 📅 2026-07-31");
  });
});
