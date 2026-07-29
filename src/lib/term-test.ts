export type TermTestKey = {
  questionId: string;
  optionIds: string[];
  correctOptionId: string;
};

export type TermTestAnswerInput = {
  questionId: string;
  optionId: string;
};

export type GradedAnswer = {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
};

/**
 * Grades one term-test attempt. Unlike the practice grader, a missing answer is
 * not an error - it counts as wrong. Duplicate answers for one question and
 * option IDs that do not belong to their question are still rejected, because
 * they indicate a malformed submission rather than an unanswered question.
 * Pure - no I/O.
 */
export function gradeTermTest(
  answerKeys: TermTestKey[],
  answers: TermTestAnswerInput[],
): { ok: true; score: number; total: number; graded: GradedAnswer[] } | { ok: false; error: string } {
  const byQuestion = new Map<string, string>();
  for (const answer of answers) {
    if (byQuestion.has(answer.questionId)) {
      return { ok: false, error: "Each question can only have one answer." };
    }
    byQuestion.set(answer.questionId, answer.optionId);
  }

  const known = new Set(answerKeys.map((k) => k.questionId));
  for (const questionId of byQuestion.keys()) {
    if (!known.has(questionId)) {
      return { ok: false, error: "An answer does not belong to this test." };
    }
  }

  const graded: GradedAnswer[] = [];
  for (const key of answerKeys) {
    const selected = byQuestion.get(key.questionId) ?? null;
    if (selected !== null && !key.optionIds.includes(selected)) {
      return { ok: false, error: "An answer does not belong to this test." };
    }
    graded.push({
      questionId: key.questionId,
      selectedOptionId: selected,
      correctOptionId: key.correctOptionId,
      isCorrect: selected !== null && selected === key.correctOptionId,
    });
  }

  return {
    ok: true,
    score: graded.filter((g) => g.isCorrect).length,
    total: answerKeys.length,
    graded,
  };
}

export type TermTestState = "not_open" | "open" | "submitted_pending" | "released";

/** Derives the student-facing state. Pure. `now >= resultsReleaseAt` releases. */
export function deriveTermTestState(input: {
  status: string;
  resultsReleaseAt: Date;
  now: Date;
  hasAttempt: boolean;
}): TermTestState {
  const released = input.now.getTime() >= input.resultsReleaseAt.getTime();
  if (released) return "released";
  if (input.status !== "approved") return "not_open";
  return input.hasAttempt ? "submitted_pending" : "open";
}

export type CohortMember = {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
};

export type AttemptScore = {
  studentId: string;
  score: number;
  submittedAt: Date;
};

export type BoardRow = { rank: number; name: string; score: number; isMe: boolean };

function displayName(firstName: string | null, lastName: string | null): string {
  const first = (firstName ?? "").trim() || "Student";
  const initial = (lastName ?? "").trim().charAt(0);
  return initial ? `${first} ${initial}.` : first;
}

/**
 * Merges the cohort with the attempts: a cohort member with no attempt scores 0.
 * Ranks by score desc, then earliest submission (no-shows, having no
 * submission, sort after everyone who submitted). A `me` row is returned only
 * when the viewer is outside the top N. Pure.
 */
export function rankTermTestBoard(
  cohort: CohortMember[],
  attempts: AttemptScore[],
  meId: string,
  opts?: { topN?: number },
): { top: BoardRow[]; me: BoardRow | null } {
  const topN = opts?.topN ?? 20;
  const scoreById = new Map(attempts.map((a) => [a.studentId, a]));
  const merged = cohort.map((m) => {
    const a = scoreById.get(m.studentId);
    return {
      studentId: m.studentId,
      name: displayName(m.firstName, m.lastName),
      score: a?.score ?? 0,
      submittedAt: a?.submittedAt ?? null,
    };
  });

  merged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.submittedAt && b.submittedAt) {
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    }
    if (a.submittedAt) return -1;
    if (b.submittedAt) return 1;
    return 0;
  });

  const ranked: BoardRow[] = merged.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    isMe: r.studentId === meId,
  }));

  const top = ranked.slice(0, topN);
  const me = ranked.find((r) => r.isMe) ?? null;
  const meOutsideTop = me && !top.some((r) => r.isMe) ? me : null;
  return { top, me: meOutsideTop };
}
