/**
 * The fields of a lesson note, in the editor's order and words, who sees
 * each one, and the two visibility labels the editor puts over them. Every
 * place that shows a note reads this list, so a field is never named two ways
 * or left out.
 *
 * A note is one optional comment for the family plus an optional internal
 * note (owner decision, 29 October 2026). The older topic, performance,
 * strengths, struggles, next-focus and key-concepts columns are no longer
 * written or shown; the editor clears them whenever it saves a note.
 */

export type NoteAudience = "family" | "staff";

export const LESSON_NOTE_FIELDS = [
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
  /** The internal label as an admin reads it, where "you" would be wrong. */
  internalForAdmin: "Only the tutor and admins see this",
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
