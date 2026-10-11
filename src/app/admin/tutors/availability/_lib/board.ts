/*
 * Pure helpers for the tutor availability board's subject filter.
 */

type Slot = {
  weekday: number | null;
  subjectId: string | null;
  subjectName: string | null;
};

/**
 * Slots that can serve a subject: those scoped to it plus "any subject" slots
 * (subject_id NULL), which apply to every subject. No subject keeps them all.
 */
export function slotsForSubject<S extends Slot>(slots: S[], subjectId: string): S[] {
  if (!subjectId) return slots;
  return slots.filter(
    (slot) => slot.subjectId === null || slot.subjectId === subjectId,
  );
}

/** Every subject a tutor teaches or has slots for, de-duplicated and sorted. */
export function boardSubjects(
  tutors: Array<{
    subjects: Array<{ id: string; name: string }>;
    slots: Slot[];
  }>,
): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>();
  for (const tutor of tutors) {
    for (const subject of tutor.subjects) byId.set(subject.id, subject.name);
    for (const slot of tutor.slots) {
      if (slot.subjectId && !byId.has(slot.subjectId)) {
        byId.set(slot.subjectId, slot.subjectName ?? "Other subject");
      }
    }
  }
  return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** How many tutors have at least one slot on a weekday (JS getDay code). */
export function freeTutorCount(
  tutors: Array<{ slots: Slot[] }>,
  weekday: number,
): number {
  return tutors.filter((tutor) =>
    tutor.slots.some((slot) => slot.weekday === weekday),
  ).length;
}
