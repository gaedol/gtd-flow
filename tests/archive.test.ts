import { describe, it, expect } from "vitest";
import { archiveDoneTasks } from "../src/archive";

const TODAY = "2026-06-12";

describe("archiveDoneTasks", () => {
  it("moves old done tasks under a new Archive heading", () => {
    const c = ["# P", "- [x] old ✅ 2026-06-01", "- [ ] open"].join("\n");
    const r = archiveDoneTasks(c, TODAY, 7);
    expect(r.moved).toBe(1);
    expect(r.content).toBe(
      ["# P", "- [ ] open", "", "## Archive", "- [x] old ✅ 2026-06-01", ""].join("\n")
    );
  });

  it("respects the age threshold", () => {
    const c = "- [x] recent ✅ 2026-06-11";
    expect(archiveDoneTasks(c, TODAY, 7).moved).toBe(0);
    expect(archiveDoneTasks(c, TODAY, 0).moved).toBe(1);
  });

  it("archives tasks without a completion date", () => {
    expect(archiveDoneTasks("- [x] no date", TODAY, 7).moved).toBe(1);
  });

  it("appends to an existing Archive section", () => {
    const c = ["- [x] a ✅ 2026-06-01", "", "## Archive", "- [x] earlier ✅ 2026-05-01"].join("\n");
    const r = archiveDoneTasks(c, TODAY, 7);
    expect(r.moved).toBe(1);
    expect(r.content).toBe(
      ["", "## Archive", "- [x] earlier ✅ 2026-05-01", "- [x] a ✅ 2026-06-01", ""].join("\n")
    );
  });

  it("moves groups whole and only when fully done and aged", () => {
    const allDone = ["- [x] group ✅ 2026-06-01", "  - [x] child ✅ 2026-06-01"].join("\n");
    expect(archiveDoneTasks(allDone, TODAY, 7).moved).toBe(2);

    const childOpen = ["- [x] group ✅ 2026-06-01", "  - [ ] child"].join("\n");
    expect(archiveDoneTasks(childOpen, TODAY, 7).moved).toBe(0);

    const childRecent = ["- [x] group ✅ 2026-06-01", "  - [x] child ✅ 2026-06-11"].join("\n");
    expect(archiveDoneTasks(childRecent, TODAY, 7).moved).toBe(0);
  });

  it("leaves done children of open parents in place", () => {
    const c = ["- [ ] group", "  - [x] child ✅ 2026-06-01"].join("\n");
    expect(archiveDoneTasks(c, TODAY, 7).moved).toBe(0);
  });

  it("never re-archives tasks already in the Archive section", () => {
    const c = ["- [ ] open", "", "## Archive", "- [x] done ✅ 2026-01-01"].join("\n");
    expect(archiveDoneTasks(c, TODAY, 0).moved).toBe(0);
  });
});
