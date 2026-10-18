/*
 * What families see of a tutor's lesson note: the shared fields of
 * `lesson-note-fields` (the ones the tutor's editor marks "Parent and student
 * will see this"). The internal note is never one of them. A recap reaches
 * the family when any of these is filled, so a note with only an internal
 * comment is not a recap.
 */

import { sharedNoteFields, type LessonNoteSharedKey } from "@/lib/lesson-note-fields";

type FamilyNoteField = LessonNoteSharedKey;

export type FamilyNote = Record<FamilyNoteField, string | null>;

/** Accent per field, from the StudentRecapPage handoff. */
const FIELD_ACCENT: Record<FamilyNoteField, string> = {
  topicCovered: "#17152B",
  performance: "#3B4FD8",
  strengths: "#15803D",
  struggles: "#D97706",
  nextLessonFocus: "#7C62F0",
  parentVisibleComment: "#2E9C86",
};

export type RecapBlock = { field: FamilyNoteField; label: string; body: string; accent: string };

/**
 * The filled family fields, in the editor's order and with its labels
 * (`lesson-note-fields`), so the family reads what the tutor wrote under the
 * same names.
 */
export function recapBlocks(note: Partial<FamilyNote> | null | undefined): RecapBlock[] {
  if (!note) return [];
  return sharedNoteFields(note).map((f) => ({
    field: f.key,
    label: f.label,
    body: f.value,
    accent: FIELD_ACCENT[f.key],
  }));
}

/** True when the note has anything a family may read. */
export function hasFamilyNote(note: Partial<FamilyNote> | null | undefined): boolean {
  return recapBlocks(note).length > 0;
}

/**
 * One line to stand for a recap in a list: the comment, else the first
 * other filled field.
 */
export function recapPreview(note: Partial<FamilyNote> | null | undefined): string | null {
  const blocks = recapBlocks(note);
  return (blocks.find((b) => b.field === "parentVisibleComment") ?? blocks[0])?.body ?? null;
}
