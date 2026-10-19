import { describe, expect, it } from "vitest";
import {
  LESSON_NOTE_FIELDS,
  LESSON_NOTE_SHARED_FIELDS,
  hasFamilyVisibleContent,
  sharedNoteFields,
} from "./lesson-note-fields";

describe("lesson note fields", () => {
  it("lists the editor's fields in its order, the internal note for staff only", () => {
    expect(LESSON_NOTE_FIELDS.map((f) => [f.key, f.audience])).toEqual([
      ["topicCovered", "family"],
      ["performance", "family"],
      ["strengths", "family"],
      ["struggles", "family"],
      ["nextLessonFocus", "family"],
      ["parentVisibleComment", "family"],
      ["internalNote", "staff"],
    ]);
    expect(LESSON_NOTE_SHARED_FIELDS.map((f) => f.key)).not.toContain("internalNote");
  });

  it("returns only the filled family fields, trimmed, with their labels", () => {
    expect(
      sharedNoteFields({
        topicCovered: " Fractions ",
        performance: "",
        struggles: "Common denominators",
        parentVisibleComment: null,
        internalNote: "Private",
      }),
    ).toEqual([
      { key: "topicCovered", label: "Topic covered", value: "Fractions" },
      { key: "struggles", label: "Struggled with", value: "Common denominators" },
    ]);
  });

  it("says whether the family would see anything", () => {
    expect(hasFamilyVisibleContent({ nextLessonFocus: "Ratios" })).toBe(true);
    expect(hasFamilyVisibleContent({ internalNote: "Only staff", parentVisibleComment: "  " })).toBe(false);
    expect(hasFamilyVisibleContent({})).toBe(false);
  });
});
