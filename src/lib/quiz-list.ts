/*
 * Pure helpers for the admin quiz list. Client-safe.
 */

/**
 * Rows arrive most-recently-updated first. Bucketing preserves that inside each
 * subject, and the buckets themselves go alphabetical - a subject list has no
 * meaningful recency order, and A-Z is the one a reader can predict. Buckets
 * are by subject id: two subjects can share a name, and their labels carry
 * the year level to tell them apart.
 */
export function groupQuizzesBySubject<T extends { subjectId: string; subjectLabel: string }>(
  rows: T[],
): { subjectId: string; label: string; rows: T[] }[] {
  const bySubject = new Map<string, { subjectId: string; label: string; rows: T[] }>();
  for (const row of rows) {
    const group = bySubject.get(row.subjectId) ?? {
      subjectId: row.subjectId,
      label: row.subjectLabel,
      rows: [],
    };
    group.rows.push(row);
    bySubject.set(row.subjectId, group);
  }
  return Array.from(bySubject.values()).sort((a, b) => a.label.localeCompare(b.label));
}
