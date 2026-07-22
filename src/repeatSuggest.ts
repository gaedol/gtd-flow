import { parseRepeat } from "./repeat";

// Given the text captured right after 🔁, decide whether the suggester should
// keep offering repeat presets or hand off to the field suggester. Once the
// rule is complete and a new word has begun, that word is a new field (e.g.
// typing "due" to add 📅), except while still composing "when done".
export function repeatSuggestMode(query: string): { mode: "repeat" | "field"; query: string } {
  const lastWord = query.match(/([a-z]+)$/)?.[1] ?? "";
  const head = query.slice(0, query.length - lastWord.length).trim();
  const composingWhen = lastWord.length > 0 && "when".startsWith(lastWord);
  if (head && lastWord && !composingWhen && parseRepeat(head)) {
    return { mode: "field", query: lastWord };
  }
  return { mode: "repeat", query };
}
