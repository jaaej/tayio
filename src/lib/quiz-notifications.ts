/** Body of the "Quiz requested" notification an admin's request sends a tutor. */
export function quizRequestBody(input: {
  title: string;
  subjectName: string;
  termNumber: number;
  weekNumber: number;
  note?: string | null;
}): string {
  const ask = `Build "${input.title}" for ${input.subjectName}, Term ${input.termNumber} Week ${input.weekNumber}.`;
  const note = input.note?.trim();
  return note ? `${ask} Admin's note: ${note}` : ask;
}
