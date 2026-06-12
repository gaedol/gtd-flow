import { describe, it, expect } from "vitest";
import { parseRepeat, nextOccurrenceLine } from "../src/repeat";

const TODAY = "2026-06-12";

describe("parseRepeat", () => {
  it("parses simple and counted rules", () => {
    expect(parseRepeat("every week")).toEqual({ n: 1, unit: "w", whenDone: false });
    expect(parseRepeat("every 2 weeks")).toEqual({ n: 2, unit: "w", whenDone: false });
    expect(parseRepeat("every 3 months when done")).toEqual({ n: 3, unit: "m", whenDone: true });
  });

  it("rejects unknown rules", () => {
    expect(parseRepeat("fortnightly")).toBeNull();
  });
});

describe("nextOccurrenceLine", () => {
  it("advances all dates by the interval", () => {
    const next = nextOccurrenceLine("- [ ] Water plants 🔁 every week 🛫 2026-06-10 📅 2026-06-12", TODAY);
    expect(next).toBe("- [ ] Water plants 🔁 every week 🛫 2026-06-17 📅 2026-06-19");
  });

  it("'when done' anchors on completion date, preserving offsets", () => {
    // due 06-01 (overdue), defer 2 days before due; done today + 1 week → due 06-19, defer 06-17
    const next = nextOccurrenceLine("- [ ] Report 🔁 every week when done 🛫 2026-05-30 📅 2026-06-01", TODAY);
    expect(next).toBe("- [ ] Report 🔁 every week when done 🛫 2026-06-17 📅 2026-06-19");
  });

  it("returns null without a repeat rule or without dates", () => {
    expect(nextOccurrenceLine("- [ ] plain 📅 2026-06-12", TODAY)).toBeNull();
    expect(nextOccurrenceLine("- [ ] dateless 🔁 every week", TODAY)).toBeNull();
  });
});
