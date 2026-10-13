/*
 * Pure helpers for the admin quiz list. Client-safe.
 */

/**
 * Rows arrive most-recently-updated first. Bucketing preserves that inside each
 * subject, and the buckets themselves go alphabetical - a subject list has no
 * meaningful recency order, and A-Z is the one a reader can predict.
 */
export function groupQuizzesBySubject<T extends { subjectName: string }>(
  rows: T[],
): [string, T[]][] {
  const bySubject = new Map<string, T[]>();
  for (const row of rows) {
    const list = bySubject.get(row.subjectName) ?? [];
    list.push(row);
    bySubject.set(row.subjectName, list);
  }
  return Array.from(bySubject.entries()).sort(([a], [b]) => a.localeCompare(b));
}
