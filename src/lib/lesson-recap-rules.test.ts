import { describe, expect, it } from "vitest";
import { hasFamilyNote, recapBlocks, recapPreview } from "./lesson-recap-rules";

const empty = {
  topicCovered: null,
  performance: null,
  strengths: null,
  struggles: null,
  nextLessonFocus: null,
  parentVisibleComment: null,
};

describe("recapBlocks", () => {
  it("lists every filled family field in the editor's order", () => {
    const blocks = recapBlocks({
      ...empty,
      parentVisibleComment: "Great work",
      topicCovered: "Quadratics",
      performance: "On track",
      struggles: "  ",
    });
    // In the editor's words, so a field is never named two ways.
    expect(blocks.map((b) => [b.label, b.body])).toEqual([
      ["Topic covered", "Quadratics"],
      ["Performance", "On track"],
      ["Comment", "Great work"],
    ]);
  });

  it("never includes the internal note", () => {
    const note = { ...empty, internalNote: "Private" } as typeof empty;
    expect(recapBlocks(note)).toEqual([]);
  });
});

describe("hasFamilyNote", () => {
  it("is a recap when any family field is filled, not only the comment", () => {
    expect(hasFamilyNote({ ...empty, nextLessonFocus: "Factorising" })).toBe(true);
    expect(hasFamilyNote({ ...empty, strengths: "Confident" })).toBe(true);
  });

  it("is not a recap when nothing family-visible is written", () => {
    expect(hasFamilyNote(empty)).toBe(false);
    expect(hasFamilyNote({ ...empty, topicCovered: "   " })).toBe(false);
    expect(hasFamilyNote(null)).toBe(false);
  });
});

describe("recapPreview", () => {
  it("prefers the comment, else the first filled field", () => {
    expect(recapPreview({ ...empty, topicCovered: "Ratios", parentVisibleComment: "Well done" })).toBe("Well done");
    expect(recapPreview({ ...empty, strengths: "Neat working" })).toBe("Neat working");
    expect(recapPreview(empty)).toBeNull();
  });
});
