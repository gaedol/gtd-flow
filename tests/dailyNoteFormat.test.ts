import { describe, it, expect } from "vitest";
import { dailyNotePath, expandDailyTemplate } from "../src/dailyNoteFormat";

// stand-in for moment().format on 2026-10-01 14:05
const fmt = (f: string) =>
  f.replace(/YYYY/g, "2026").replace(/MM/g, "10").replace(/DD/g, "01").replace(/HH/g, "14").replace(/mm/g, "05").replace(/dddd/g, "Thursday");

describe("dailyNotePath", () => {
  it("joins folder and formatted name", () => {
    expect(dailyNotePath({ folder: "Daily", format: "YYYY-MM-DD", template: "" }, fmt)).toBe("Daily/2026-10-01.md");
  });

  it("puts the note at the vault root without a folder, and trims slashes", () => {
    expect(dailyNotePath({ folder: "", format: "", template: "" }, fmt)).toBe("2026-10-01.md");
    expect(dailyNotePath({ folder: "/Journal/", format: "YYYY/MM/YYYY-MM-DD", template: "" }, fmt)).toBe(
      "Journal/2026/10/2026-10-01.md"
    );
  });
});

describe("expandDailyTemplate", () => {
  it("expands title, date and time, with and without custom formats", () => {
    const out = expandDailyTemplate("# {{title}}\n{{date}} {{time}} {{date:dddd}} {{ time:HH }}", "2026-10-01", "YYYY-MM-DD", fmt);
    expect(out).toBe("# 2026-10-01\n2026-10-01 14:05 Thursday 14");
  });
});
