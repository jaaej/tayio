/**
 * Pure helpers for the student Progress split view: the overall summary in
 * the list pane, each subject's focus topic, the homework counts and the
 * merged "Recent marks" list. Kept free of the database so they are unit
 * tested.
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

/** A topic the student should work on: needs effort, or not started yet. */
export function isFocusTopic(t: { mastery: Mastery }): boolean {
  return t.mastery === "needs_work" || t.mastery === "not_started";
}

/**
 * Overall mastery across subjects that have tracked topics (a subject with
 * no topics yet is not a 0%), plus topic counts. `percent` is null when
 * nothing is tracked anywhere.
 */
export function overallSummary(
  subjects: Array<{ masteryPercent: number; topics: Topic[] }>,
): { percent: number | null; topics: number; strong: number; improving: number; focus: number } {
  const tracked = subjects.filter((s) => s.topics.length > 0);
  const topics = tracked.flatMap((s) => s.topics);
  return {
    percent:
      tracked.length === 0
        ? null
        : Math.round(tracked.reduce((sum, s) => sum + s.masteryPercent, 0) / tracked.length),
    topics: topics.length,
    strong: topics.filter((t) => t.mastery === "strong").length,
    improving: topics.filter((t) => t.mastery === "improving").length,
    focus: topics.filter(isFocusTopic).length,
  };
}

/** The first topic that needs effort (needs work before not started). */
export function focusTopic(topics: Topic[]): string | null {
  return (
    topics.find((t) => t.mastery === "needs_work")?.topic ??
    topics.find((t) => t.mastery === "not_started")?.topic ??
    null
  );
}

type HomeworkStatus =
  | "not_started"
  | "viewed"
  | "submitted"
  | "late"
  | "marked"
  | "returned"
  | "resubmission_requested";

/** Handed in (waiting or marked) vs still to do (incl. a requested redo). */
export function homeworkCounts(rows: Array<{ status: HomeworkStatus }>): {
  submitted: number;
  pending: number;
} {
  let submitted = 0;
  let pending = 0;
  for (const { status } of rows) {
    if (status === "submitted" || status === "late" || status === "marked" || status === "returned") {
      submitted += 1;
    } else {
      pending += 1;
    }
  }
  return { submitted, pending };
}

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
