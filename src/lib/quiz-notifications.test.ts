import { describe, expect, it } from "vitest";
import { quizRequestBody } from "./quiz-notifications";

describe("quizRequestBody", () => {
  const base = {
    title: "Fractions check",
    subjectName: "Year 9 Maths",
    termNumber: 4,
    weekNumber: 3,
  };

  it("names the quiz and its week", () => {
    expect(quizRequestBody(base)).toBe(
      'Build "Fractions check" for Year 9 Maths, Term 4 Week 3.',
    );
  });

  it("adds the admin's note when there is one", () => {
    expect(quizRequestBody({ ...base, note: "  10 questions, no calculators. " })).toBe(
      'Build "Fractions check" for Year 9 Maths, Term 4 Week 3. Admin\'s note: 10 questions, no calculators.',
    );
  });

  it("ignores a blank note", () => {
    expect(quizRequestBody({ ...base, note: "   " })).toBe(quizRequestBody(base));
  });
});
