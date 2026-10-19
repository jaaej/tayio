/**
 * The fields of a lesson note, in the editor's order and words, who sees
 * each one, and the two visibility labels the editor puts over them. Every
 * place that shows a note reads this list, so a field is never named two ways
 * or left out. `key_concepts` is not here: the editor no longer writes it and
 * no note has it.
 */

export type NoteAudience = "family" | "staff";

export const LESSON_NOTE_FIELDS = [
  { key: "topicCovered", label: "Topic covered", audience: "family" },
  { key: "performance", label: "Performance", audience: "family" },
  { key: "strengths", label: "Strengths", audience: "family" },
  { key: "struggles", label: "Struggled with", audience: "family" },
  { key: "nextLessonFocus", label: "Next lesson focus", audience: "family" },
  { key: "parentVisibleComment", label: "Comment", audience: "family" },
  { key: "internalNote", label: "Internal note", audience: "staff" },
] as const satisfies readonly { key: string; label: string; audience: NoteAudience }[];

export type LessonNoteKey = (typeof LESSON_NOTE_FIELDS)[number]["key"];

/** The fields the student and their parents see. */
export const LESSON_NOTE_SHARED_FIELDS = LESSON_NOTE_FIELDS.filter(
  (field): field is Extract<(typeof LESSON_NOTE_FIELDS)[number], { audience: "family" }> =>
    field.audience === "family",
);

export type LessonNoteSharedKey = (typeof LESSON_NOTE_SHARED_FIELDS)[number]["key"];

/** Who sees each part of a note, as the editor labels it for its author. */
export const NOTE_VISIBILITY = {
  shared: "Parent and student will see this",
  internal: "Only you and admin see this",
} as const;

type NoteValues = Partial<Record<LessonNoteKey, string | null>>;

/** The family-visible fields a note has filled in, in the editor's order. */
export function sharedNoteFields(
  note: NoteValues,
): { key: LessonNoteSharedKey; label: string; value: string }[] {
  return LESSON_NOTE_SHARED_FIELDS.flatMap((field) => {
    const value = note[field.key]?.trim();
    return value ? [{ key: field.key, label: field.label, value }] : [];
  });
}

/** Whether a note has anything the student and their parents would see. */
export function hasFamilyVisibleContent(note: NoteValues): boolean {
  return sharedNoteFields(note).length > 0;
}
