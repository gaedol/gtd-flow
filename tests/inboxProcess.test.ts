import { describe, it, expect } from "vitest";
import { cutTaskBlock, dedent, noteNameFor, projectBody, referenceBody, findProject } from "../src/inboxProcess";
import { Project } from "../src/types";

describe("cutTaskBlock", () => {
  const doc = ["- [ ] keep", "- [ ] plan party 📅 2026-12-01", "    - [ ] guest list", "    - ask Sam", "- [ ] after"].join("\n");

  it("removes the task with its subtasks and notes, returned dedented", () => {
    const r = cutTaskBlock(doc, 1)!;
    expect(r.content).toBe("- [ ] keep\n- [ ] after");
    expect(r.block).toEqual(["- [ ] plan party 📅 2026-12-01", "    - [ ] guest list", "    - ask Sam"]);
  });

  it("dedents a nested task to column 0", () => {
    expect(cutTaskBlock(doc, 2)!.block).toEqual(["- [ ] guest list"]);
  });

  it("refuses a line that isn't a task", () => {
    expect(cutTaskBlock(doc, 3)).toBeNull();
  });

  it("dedent keeps blank lines and relative depth", () => {
    expect(dedent(["  a", "", "    b"])).toEqual(["a", "", "  b"]);
  });
});

describe("noteNameFor", () => {
  it("strips characters notes can't have and keeps link labels", () => {
    expect(noteNameFor("Plan [[Rome|Rome trip]]: flights / hotel?")).toBe("Plan Rome trip flights hotel");
    expect(noteNameFor("Read [[Getting Things Done]] #book")).toBe("Read Getting Things Done book");
  });
});

describe("projectBody", () => {
  it("a bare one-liner becomes an empty first step", () => {
    expect(projectBody(["- [ ] Plan party"])).toBe("- [ ] \n");
  });

  it("keeps the item when it carries dates, tags or subtasks", () => {
    expect(projectBody(["- [ ] Plan party 📅 2026-12-01"])).toBe("- [ ] Plan party 📅 2026-12-01\n");
    expect(projectBody(["- [ ] Plan party #home"])).toBe("- [ ] Plan party #home\n");
    expect(projectBody(["- [ ] Plan party", "    - [ ] guests"])).toBe("- [ ] Plan party\n    - [ ] guests\n");
  });
});

describe("referenceBody", () => {
  it("drops the checkbox and keeps the notes", () => {
    expect(referenceBody(["- [ ] Wifi password at the cabin", "    - it's on the router"])).toBe(
      "Wifi password at the cabin\n\n    - it's on the router\n"
    );
    expect(referenceBody(["- [ ] Tram 7 runs every 10 min"])).toBe("Tram 7 runs every 10 min\n");
  });
});

describe("findProject", () => {
  const p = (path: string, label: string): Project => ({
    path, name: path.replace(/.*\//, "").replace(/\.md$/, ""), label, status: "active", flow: "parallel", tasks: [],
  });
  const projects = [p("GTD/Projects/Errands.md", "Errands"), p("GTD/Projects/Home/Errands.md", "Home/Errands")];

  it("matches by area label, name or path", () => {
    expect(findProject(projects, "Home/Errands")).toBe(projects[1]);
    expect(findProject(projects, "Errands")).toBe(projects[0]);
    expect(findProject(projects, "GTD/Projects/Home/Errands.md")).toBe(projects[1]);
  });

  it("is undefined when empty or unknown", () => {
    expect(findProject(projects, "")).toBeUndefined();
    expect(findProject(projects, "Nope")).toBeUndefined();
  });
});
