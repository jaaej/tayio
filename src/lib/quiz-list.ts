/*
 * Pure helpers for the quiz lists (admin Quizzes, tutor Quizzes). Client-safe.
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

export type QuizBucket = { value: string; label: string; statuses: readonly string[] };

/**
 * Status buckets on the tutor Quizzes page, keyed by the `?status=` value.
 * `todoStatuses` is the nav badge's TUTOR_QUIZ_TODO_STATUSES, passed in so
 * the badge count and the To do list can never disagree.
 */
export function tutorQuizBuckets(todoStatuses: readonly string[]): QuizBucket[] {
  return [
    { value: "todo", label: "To do", statuses: todoStatuses },
    { value: "submitted", label: "Submitted", statuses: ["pending_review"] },
    // "admin" belongs with "approved": it is live in the tutor's subject the
    // same way, and a status with no bucket would vanish from filtered views.
    { value: "done", label: "Done", statuses: ["approved", "admin"] },
  ];
}

/** The action a tutor takes on a quiz waiting on them. */
export function tutorQuizAction(row: { status: string; questionCount: number }): string {
  if (row.status === "changes_requested") return "Fix quiz";
  return row.questionCount === 0 ? "Start quiz" : "Continue quiz";
}
