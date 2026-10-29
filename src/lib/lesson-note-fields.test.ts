import { describe, expect, it } from "vitest";
import {
  LESSON_NOTE_FIELDS,
  LESSON_NOTE_SHARED_FIELDS,
  hasFamilyVisibleContent,
  sharedNoteFields,
} from "./lesson-note-fields";

describe("lesson note fields", () => {
  it("is one comment for the family and an internal note for staff only", () => {
    expect(LESSON_NOTE_FIELDS.map((f) => [f.key, f.label, f.audience])).toEqual([
      ["parentVisibleComment", "Comment", "family"],
      ["internalNote", "Internal note", "staff"],
    ]);
    expect(LESSON_NOTE_SHARED_FIELDS.map((f) => f.key)).toEqual(["parentVisibleComment"]);
  });

  it("returns the comment, trimmed, with its label, and never the internal note", () => {
    expect(sharedNoteFields({ parentVisibleComment: " Great work ", internalNote: "Private" })).toEqual([
      { key: "parentVisibleComment", label: "Comment", value: "Great work" },
    ]);
    expect(sharedNoteFields({ parentVisibleComment: null, internalNote: "Private" })).toEqual([]);
  });

  it("says whether the family would see anything", () => {
    expect(hasFamilyVisibleContent({ parentVisibleComment: "Well done" })).toBe(true);
    expect(hasFamilyVisibleContent({ internalNote: "Only staff", parentVisibleComment: "  " })).toBe(false);
    expect(hasFamilyVisibleContent({})).toBe(false);
  });
});
