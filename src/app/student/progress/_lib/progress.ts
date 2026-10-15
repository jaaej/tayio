/**
 * Pure helpers for the student Progress split view: overall mastery, the
 * term picker, issued reports and the merged "Recent marks" list. Kept free
 * of the database so they are unit tested.
 */

export type Mastery = "not_started" | "needs_work" | "improving" | "strong";

export const MASTERY_LABEL: Record<Mastery, string> = {
  strong: "All good",
  improving: "Improving",
  needs_work: "Needs focused effort",
  not_started: "Not started",
};

/** The order levels are explained in, best first. */
export const MASTERY_ORDER: Mastery[] = ["strong", "improving", "needs_work", "not_started"];

type Topic = { topic: string; mastery: Mastery };

/**
 * Overall mastery across subjects that have tracked topics (a subject with
 * no topics yet is not a 0%). Null when nothing is tracked anywhere.
 */
export function overallMastery(
  subjects: Array<{ masteryPercent: number; topics: Topic[] }>,
): number | null {
  const tracked = subjects.filter((s) => s.topics.length > 0);
  if (tracked.length === 0) return null;
  return Math.round(tracked.reduce((sum, s) => sum + s.masteryPercent, 0) / tracked.length);
}

export type ProgressTerm = {
  id: string;
  label: string;
  /** Melbourne dates, YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  /**
   * The days whose work counts towards the term: from its start (null for
   * the student's first term, which also takes anything earlier) until the
   * day before the next term starts (null when no later term exists), so
   * work due in the holidays still lands in a term.
   */
  coversFrom: string | null;
  coversUntil: string | null;
};

function dayBefore(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * The terms the picker offers: started by today and not over before the
 * student's first enrolment, newest first. Dates are Melbourne YYYY-MM-DD.
 */
export function progressTerms(
  terms: Array<{ id: string; year: number; termNumber: number; startDate: string; endDate: string }>,
  firstEnrolledOn: string | null,
  today: string,
): ProgressTerm[] {
  const all = [...terms].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const offered = all.filter(
    (t) => t.startDate <= today && (!firstEnrolledOn || t.endDate >= firstEnrolledOn),
  );
  return offered
    .map((t, i) => {
      const next = all.find((n) => n.startDate > t.startDate);
      return {
        id: t.id,
        label: `Term ${t.termNumber} · ${t.year}`,
        startDate: t.startDate,
        endDate: t.endDate,
        coversFrom: i === 0 ? null : t.startDate,
        coversUntil: next ? dayBefore(next.startDate) : null,
      };
    })
    .reverse();
}

/**
 * The term to show: the one asked for if it is on offer, else the term
 * running today, else the latest one. Null when there are no terms.
 */
export function pickTerm(
  terms: ProgressTerm[],
  requested: string | null | undefined,
  today: string,
): ProgressTerm | null {
  return (
    terms.find((t) => t.id === requested) ??
    terms.find((t) => t.startDate <= today && today <= t.endDate) ??
    terms[0] ??
    null
  );
}

/** Whether a Melbourne date (YYYY-MM-DD) counts towards the term. */
export function inTerm(
  day: string,
  term: { coversFrom: string | null; coversUntil: string | null },
): boolean {
  return (!term.coversFrom || term.coversFrom <= day) && (!term.coversUntil || day <= term.coversUntil);
}

/**
 * The terms whose report was issued to this student, from the hrefs of the
 * "Term report ready" notifications they received (`/reports/<student>/<term>`),
 * once each, in the order given.
 */
export function issuedReportTermIds(hrefs: Array<string | null>, studentId: string): string[] {
  const prefix = `/reports/${studentId}/`;
  const ids: string[] = [];
  for (const href of hrefs) {
    if (!href?.startsWith(prefix)) continue;
    const id = href.slice(prefix.length).split(/[/?#]/)[0];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

type HomeworkStatus =
  | "not_started"
  | "viewed"
  | "submitted"
  | "late"
  | "marked"
  | "returned"
  | "resubmission_requested";

/** Marked homework: a score and a marked/returned status. */
export function isMarkedHomework(h: { status: HomeworkStatus; score: string | null }): boolean {
  return h.score !== null && (h.status === "marked" || h.status === "returned");
}

export type QuizAttemptRow = {
  quizId: string;
  title: string;
  correctCount: number;
  total: number;
  submittedAt: Date;
};

export type QuizResult = QuizAttemptRow & { tries: number };

/**
 * The latest attempt at each quiz with the number of tries, newest first.
 * The latest attempt is the one the average score counts (see
 * `averageScore`), so the mark shown is the mark that counts.
 */
export function latestQuizResults(rows: QuizAttemptRow[]): QuizResult[] {
  const byQuiz = new Map<string, QuizResult>();
  for (const row of rows) {
    const prev = byQuiz.get(row.quizId);
    if (!prev) byQuiz.set(row.quizId, { ...row, tries: 1 });
    else {
      const latest = row.submittedAt > prev.submittedAt ? row : prev;
      byQuiz.set(row.quizId, { ...latest, tries: prev.tries + 1 });
    }
  }
  return [...byQuiz.values()].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
}

export type RecentMark =
  | {
      kind: "homework";
      id: string;
      title: string;
      at: Date | null;
      percent: number;
      isTest: boolean;
      feedback: string | null;
    }
  | {
      kind: "quiz";
      id: string;
      title: string;
      at: Date;
      correctCount: number;
      total: number;
      tries: number;
    };

/**
 * Marked homework and latest quiz results merged newest first. Homework
 * marked before marked_at was recorded falls back to its due date, so it
 * still sorts sensibly.
 */
export function recentMarks(
  homework: Array<{
    homeworkId: string;
    title: string;
    status: HomeworkStatus;
    score: string | null;
    feedback: string | null;
    markedAt: Date | null;
    dueDate: Date;
    isTest: boolean;
  }>,
  quizzes: QuizResult[],
  limit = 5,
): RecentMark[] {
  const items: Array<{ sortAt: number; mark: RecentMark }> = [];
  for (const h of homework) {
    if (!isMarkedHomework(h)) continue;
    const percent = Number(h.score);
    if (!Number.isFinite(percent)) continue;
    items.push({
      sortAt: (h.markedAt ?? h.dueDate).getTime(),
      mark: {
        kind: "homework",
        id: h.homeworkId,
        title: h.title,
        at: h.markedAt,
        percent,
        isTest: h.isTest,
        feedback: h.feedback?.trim() || null,
      },
    });
  }
  for (const q of quizzes) {
    if (q.total <= 0) continue;
    items.push({
      sortAt: q.submittedAt.getTime(),
      mark: {
        kind: "quiz",
        id: q.quizId,
        title: q.title,
        at: q.submittedAt,
        correctCount: q.correctCount,
        total: q.total,
        tries: q.tries,
      },
    });
  }
  return items
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, limit)
    .map((i) => i.mark);
}
