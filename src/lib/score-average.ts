/**
 * Average score shared by every view of a student's results: each marked
 * homework counts at the percentage the tutor awarded, each quiz at correct
 * answers / number of questions (its latest attempt). Every item weighs the
 * same.
 */
export type ScoreAverage = {
  percent: number | null;
  homeworkCount: number;
  quizCount: number;
};

export function averageScore(
  homeworkScores: Array<string | number | null>,
  quizAttempts: Array<{ correctCount: number; total: number }>,
): ScoreAverage {
  const homework = homeworkScores
    .filter((s): s is string | number => s !== null && s !== "")
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const quizzes = quizAttempts
    .filter((a) => a.total > 0)
    .map((a) => (a.correctCount / a.total) * 100);
  const all = [...homework, ...quizzes];
  return {
    percent:
      all.length === 0
        ? null
        : Math.round(all.reduce((sum, n) => sum + n, 0) / all.length),
    homeworkCount: homework.length,
    quizCount: quizzes.length,
  };
}

/** "3 homework · 2 quizzes", naming only what the average includes. */
export function scoreAverageBasis({ homeworkCount, quizCount }: ScoreAverage): string {
  return [
    homeworkCount > 0 ? `${homeworkCount} homework` : null,
    quizCount > 0 ? `${quizCount} ${quizCount === 1 ? "quiz" : "quizzes"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
