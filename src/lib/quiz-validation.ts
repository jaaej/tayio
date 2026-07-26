export type QuizQuestionInput = {
  type: "multiple_choice" | "true_false";
  prompt: string;
  options: { text: string; isCorrect: boolean }[];
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
