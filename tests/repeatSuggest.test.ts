import { describe, it, expect } from "vitest";
import { repeatSuggestMode } from "../src/repeatSuggest";

describe("repeatSuggestMode", () => {
  it("stays in repeat while composing the rule", () => {
    expect(repeatSuggestMode("").mode).toBe("repeat");
    expect(repeatSuggestMode("every").mode).toBe("repeat");
    expect(repeatSuggestMode("every we").mode).toBe("repeat");
    expect(repeatSuggestMode("every 2 wee").mode).toBe("repeat");
  });

  it("hands off to field once a complete rule has a new trailing word", () => {
    expect(repeatSuggestMode("every week d")).toEqual({ mode: "field", query: "d" });
    expect(repeatSuggestMode("every month due")).toEqual({ mode: "field", query: "due" });
  });

  it("keeps composing 'when done' instead of treating it as a field", () => {
    expect(repeatSuggestMode("every week w").mode).toBe("repeat");
    expect(repeatSuggestMode("every week when").mode).toBe("repeat");
    expect(repeatSuggestMode("every week when done").mode).toBe("repeat");
  });
});
