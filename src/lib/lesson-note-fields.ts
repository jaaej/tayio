/**
 * The fields of a lesson note, in the editor's order and words, and the two
 * visibility labels the editor puts over them. Every place that shows a note
 * reads this list, so a field is never named two ways or left out.
 */

export const LESSON_NOTE_SHARED_FIELDS = [
  { key: "topicCovered", label: "Topic covered" },
  { key: "performance", label: "Performance" },
  { key: "strengths", label: "Strengths" },
  { key: "struggles", label: "Struggled with" },
  { key: "nextLessonFocus", label: "Next lesson focus" },
  { key: "parentVisibleComment", label: "Comment" },
] as const;

export type LessonNoteSharedKey = (typeof LESSON_NOTE_SHARED_FIELDS)[number]["key"];

/** Who sees each part of a note, as the editor labels it for its author. */
export const NOTE_VISIBILITY = {
  shared: "Parent and student will see this",
  internal: "Only you and admin see this",
} as const;

/** The shared fields a note has filled in, in the editor's order. */
export function sharedNoteFields(
  note: Partial<Record<LessonNoteSharedKey, string | null>>,
): { key: LessonNoteSharedKey; label: string; value: string }[] {
  return LESSON_NOTE_SHARED_FIELDS.flatMap((field) => {
    const value = note[field.key]?.trim();
    return value ? [{ key: field.key, label: field.label, value }] : [];
  });
}
