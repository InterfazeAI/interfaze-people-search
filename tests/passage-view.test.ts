import { describe, expect, it } from "vitest";
import { findSourcePassage } from "@/lib/passage-view";
describe("in-app source matching", () => {
  const texts = [
    { text: "An earlier paragraph.", page: 1 },
    { text: "Alice Jones is an author.", page: 2 },
    { text: "Alice Jones is an author.", page: 3 },
  ];
  it("locates the literal passage and respects page metadata", () => {
    expect(findSourcePassage(texts, "Alice Jones is an author.", 3)).toBe(2);
    expect(findSourcePassage(texts, "Alice Jones is an author.", null)).toBe(1);
  });
  it("does not fabricate a match for missing, partial, or changed evidence", () => {
    expect(findSourcePassage(texts, "Alice Jones", 2)).toBe(-1);
    expect(findSourcePassage(texts, "Alice Smith is an author.", 2)).toBe(-1);
    expect(findSourcePassage([], "Alice Jones is an author.", 2)).toBe(-1);
    expect(findSourcePassage(texts, "", null)).toBe(-1);
  });
});
