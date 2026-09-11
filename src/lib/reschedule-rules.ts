export type RescheduleClassContext = {
  subjectId: string;
  subjectYearLevel: string | null;
};

function normaliseYearLevel(value: string | null): string {
  return (value ?? "").trim().toLocaleLowerCase("en-AU");
}

/** A temporary class switch must stay inside the exact subject and year. The
 * subject id is the primary boundary; checking the denormalised year as well
 * makes the business rule explicit and protects against malformed seed data. */
export function isCompatibleRescheduleTarget(
  original: RescheduleClassContext,
  target: RescheduleClassContext,
): boolean {
  return (
    original.subjectId === target.subjectId &&
    normaliseYearLevel(original.subjectYearLevel) ===
      normaliseYearLevel(target.subjectYearLevel)
  );
}
