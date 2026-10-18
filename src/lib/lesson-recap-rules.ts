/*
 * What families see of a tutor's lesson note: the fields the tutor's editor
 * marks "Parent and student will see this" (topic, performance, strengths,
 * struggled with, next lesson focus, comment). The internal note is never
 * one of them. A recap reaches the family when any of these is filled, so a
 * note with only an internal comment is not a recap.
 */

export const FAMILY_NOTE_FIELDS = [
  "topicCovered",
  "performance",
  "strengths",
  "struggles",
  "nextLessonFocus",
  "parentVisibleComment",
] as const;

export type FamilyNoteField = (typeof FAMILY_NOTE_FIELDS)[number];

export type FamilyNote = Record<FamilyNoteField, string | null>;

/** Label and accent (from the StudentRecapPage handoff) for each field. */
const FIELD_STYLE: Record<FamilyNoteField, { label: string; accent: string }> = {
  topicCovered: { label: "Topic covered", accent: "#17152B" },
  performance: { label: "How it went", accent: "#3B4FD8" },
  strengths: { label: "What went well", accent: "#15803D" },
  struggles: { label: "What to revise", accent: "#D97706" },
  nextLessonFocus: { label: "Next lesson focus", accent: "#7C62F0" },
  parentVisibleComment: { label: "From the tutor", accent: "#2E9C86" },
};

export type RecapBlock = { field: FamilyNoteField; label: string; body: string; accent: string };

/** The filled family fields, in the editor's order. */
export function recapBlocks(note: Partial<FamilyNote> | null | undefined): RecapBlock[] {
  if (!note) return [];
  return FAMILY_NOTE_FIELDS.flatMap((field) => {
    const body = note[field]?.trim();
    return body ? [{ field, body, ...FIELD_STYLE[field] }] : [];
  });
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
