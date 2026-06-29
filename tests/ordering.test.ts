import { describe, it, expect } from "vitest";
import { defaultSort, applyManualOrder } from "../src/ordering";
import { Task } from "../src/types";

const TODAY = "2026-06-14";

function item(text: string, e: Partial<Task> = {}) {
  return { task: { text, done: false, line: 0, indent: 0, tags: [], ...e } as Task };
}

describe("defaultSort", () => {
  it("orders overdue, then flagged, then the rest (stable within rank)", () => {
    const items = [
      item("plain a"),
      item("overdue", { due: "2026-06-01" }),
      item("flagged", { tags: ["flag"] }),
      item("plain b"),
    ];
    expect(defaultSort(items, TODAY, "flag").map((i) => i.task.text)).toEqual([
      "overdue",
      "flagged",
      "plain a",
      "plain b",
    ]);
  });
});

describe("applyManualOrder", () => {
  const A = item("A", { blockId: "a" });
  const B = item("B", { blockId: "b" });
  const C = item("C", { blockId: "c" });

  it("returns the default order when nothing is saved", () => {
    expect(applyManualOrder([A, B, C], []).map((i) => i.task.text)).toEqual(["A", "B", "C"]);
  });

  it("applies the saved sequence for positioned tasks", () => {
    expect(applyManualOrder([A, B, C], ["c", "a", "b"]).map((i) => i.task.text)).toEqual(["C", "A", "B"]);
  });

  it("weaves a new (unsaved) task into its default slot", () => {
    const N = item("N"); // no block id; default order places it between A and B
    const out = applyManualOrder([A, N, B, C], ["c", "a", "b"]).map((i) => i.task.text);
    expect(out).toEqual(["C", "A", "N", "B"]); // known follow saved; N stays after its default predecessor A
  });
});
