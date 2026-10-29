import { describe, expect, it } from "vitest";
import { hasFamilyNote, recapBlocks, recapPreview } from "./lesson-recap-rules";

describe("recapBlocks", () => {
  it("is the comment, trimmed", () => {
    expect(recapBlocks({ parentVisibleComment: " Great work " }).map((b) => [b.field, b.body])).toEqual([
      ["parentVisibleComment", "Great work"],
    ]);
  });

  it("never includes the internal note", () => {
    const note = { parentVisibleComment: null, internalNote: "Private" } as { parentVisibleComment: null };
    expect(recapBlocks(note)).toEqual([]);
  });
});

describe("hasFamilyNote", () => {
  it("is a recap only when the comment has words", () => {
    expect(hasFamilyNote({ parentVisibleComment: "Factorising went well" })).toBe(true);
    expect(hasFamilyNote({ parentVisibleComment: "   " })).toBe(false);
    expect(hasFamilyNote({ parentVisibleComment: null })).toBe(false);
    expect(hasFamilyNote(null)).toBe(false);
  });
});

describe("recapPreview", () => {
  it("is the comment, or nothing", () => {
    expect(recapPreview({ parentVisibleComment: "Well done" })).toBe("Well done");
    expect(recapPreview({ parentVisibleComment: "" })).toBeNull();
    expect(recapPreview(null)).toBeNull();
  });
});
