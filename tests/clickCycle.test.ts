import { describe, it, expect } from "vitest";
import { checkboxClickAction } from "../src/clickCycle";

describe("checkboxClickAction (direct mode)", () => {
  it("completes an open task", () => {
    expect(checkboxClickAction(" ", false)).toBe("complete");
  });
  it("completes an in-progress task", () => {
    expect(checkboxClickAction("/", false)).toBe("complete");
  });
  it("reopens a done or dropped task (so its date is cleared, not left behind)", () => {
    expect(checkboxClickAction("x", false)).toBe("reopen");
    expect(checkboxClickAction("X", false)).toBe("reopen");
    expect(checkboxClickAction("-", false)).toBe("reopen");
  });
});

describe("checkboxClickAction (cycle mode)", () => {
  it("moves an open task to in-progress first", () => {
    expect(checkboxClickAction(" ", true)).toBe("in-progress");
  });
  it("completes from in-progress", () => {
    expect(checkboxClickAction("/", true)).toBe("complete");
  });
  it("also reopens done/dropped tasks", () => {
    expect(checkboxClickAction("x", true)).toBe("reopen");
    expect(checkboxClickAction("-", true)).toBe("reopen");
  });
});
