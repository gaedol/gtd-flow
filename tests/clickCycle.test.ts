import { describe, it, expect } from "vitest";
import { checkboxClickAction } from "../src/clickCycle";

describe("checkboxClickAction (direct mode)", () => {
  it("completes an open task", () => {
    expect(checkboxClickAction(" ", false)).toBe("complete");
  });
  it("completes an in-progress task", () => {
    expect(checkboxClickAction("/", false)).toBe("complete");
  });
  it("does nothing on done or dropped", () => {
    expect(checkboxClickAction("x", false)).toBe("none");
    expect(checkboxClickAction("X", false)).toBe("none");
    expect(checkboxClickAction("-", false)).toBe("none");
  });
});

describe("checkboxClickAction (cycle mode)", () => {
  it("moves an open task to in-progress first", () => {
    expect(checkboxClickAction(" ", true)).toBe("in-progress");
  });
  it("completes from in-progress", () => {
    expect(checkboxClickAction("/", true)).toBe("complete");
  });
  it("still does nothing on done/dropped", () => {
    expect(checkboxClickAction("x", true)).toBe("none");
    expect(checkboxClickAction("-", true)).toBe("none");
  });
});
