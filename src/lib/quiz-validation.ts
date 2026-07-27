export type QuizQuestionInput = {
  type: "multiple_choice" | "true_false";
  prompt: string;
  options: { text: string; isCorrect: boolean }[];
};

export type QuizAnswerKey = {
  questionId: string;
  optionIds: string[];
  correctOptionId: string;
};

export type QuizAnswer = {
  questionId: string;
  optionId: string;
};

export type QuizGrade = {
  correctCount: number;
  total: number;
  results: Array<{
    questionId: string;
    selectedOptionId: string;
    correctOptionId: string;
    isCorrect: boolean;
  }>;
};

/**
 * Returns a list of human-readable problems that block submitting a quiz for
 * review. An empty array means the quiz is ready. Pure - no I/O.
 */
export function validateQuizForSubmit(
  title: string,
  questions: QuizQuestionInput[],
): string[] {
  const problems: string[] = [];
  if (!title.trim()) problems.push("A title is required.");
  if (questions.length === 0) problems.push("Add at least one question.");

  questions.forEach((q, i) => {
    const label = `Question ${i + 1}`;
    if (!q.prompt.trim()) problems.push(`${label}: prompt is required.`);
    if (q.options.length < 2) {
      problems.push(`${label}: needs at least two options.`);
    }
    if (q.options.some((o) => !o.text.trim())) {
      problems.push(`${label}: has an empty option.`);
    }
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (correct !== 1) {
      problems.push(`${label}: must have exactly one correct option.`);
    }
  });

  return problems;
}

/**
 * Grades one complete single-select practice attempt.
 * Returns a user-facing validation error instead of accepting missing,
 * duplicated, or cross-question option IDs.
 */
export function gradeQuizAnswers(
  answerKeys: QuizAnswerKey[],
  answers: QuizAnswer[],
): { ok: true; grade: QuizGrade } | { ok: false; error: string } {
  const byQuestion = new Map<string, string>();
  for (const answer of answers) {
    if (byQuestion.has(answer.questionId)) {
      return { ok: false, error: "Each question can only have one answer." };
    }
    byQuestion.set(answer.questionId, answer.optionId);
  }

  if (byQuestion.size !== answerKeys.length) {
    return { ok: false, error: "Answer every question before checking your quiz." };
  }

  const results = [];
  for (const key of answerKeys) {
    const selectedOptionId = byQuestion.get(key.questionId);
    if (!selectedOptionId) {
      return { ok: false, error: "Answer every question before checking your quiz." };
    }
    if (!key.optionIds.includes(selectedOptionId)) {
      return { ok: false, error: "One or more answers do not belong to this quiz." };
    }
    results.push({
      questionId: key.questionId,
      selectedOptionId,
      correctOptionId: key.correctOptionId,
      isCorrect: selectedOptionId === key.correctOptionId,
    });
  }

  return {
    ok: true,
    grade: {
      correctCount: results.filter((result) => result.isCorrect).length,
      total: answerKeys.length,
      results,
    },
  };
}
