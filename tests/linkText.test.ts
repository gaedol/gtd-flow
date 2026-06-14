import { describe, it, expect } from "vitest";
import { parseWikiSegments } from "../src/linkText";

describe("parseWikiSegments", () => {
  it("returns a single plain segment when there are no links", () => {
    expect(parseWikiSegments("Buy milk")).toEqual([{ text: "Buy milk" }]);
  });

  it("splits a plain run, a bare link, and trailing text", () => {
    expect(parseWikiSegments("Service the boiler — call [[Dave]] today")).toEqual([
      { text: "Service the boiler — call " },
      { text: "Dave", link: "Dave" },
      { text: " today" },
    ]);
  });

  it("uses the alias for display but the target for the link", () => {
    expect(parseWikiSegments("Submit via [[Northwind - role|the portal]]")).toEqual([
      { text: "Submit via " },
      { text: "the portal", link: "Northwind - role" },
    ]);
  });

  it("handles multiple links in one line", () => {
    const segs = parseWikiSegments("[[A]] and [[B|bee]]");
    expect(segs).toEqual([
      { text: "A", link: "A" },
      { text: " and " },
      { text: "bee", link: "B" },
    ]);
  });

  it("handles an empty string", () => {
    expect(parseWikiSegments("")).toEqual([{ text: "" }]);
  });
});
