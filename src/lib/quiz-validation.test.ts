import { describe, it, expect } from "vitest";
import { validateQuizForSubmit, type QuizQuestionInput } from "./quiz-validation";

const mc = (over: Partial<QuizQuestionInput> = {}): QuizQuestionInput => ({
  type: "multiple_choice",
  prompt: "What is 2+2?",
  options: [
    { text: "3", isCorrect: false },
    { text: "4", isCorrect: true },
  ],
  ...over,
});

describe("validateQuizForSubmit", () => {
  it("passes a well-formed quiz", () => {
    expect(validateQuizForSubmit("Week 5", [mc()])).toEqual([]);
  });
  it("requires a title", () => {
    expect(validateQuizForSubmit("  ", [mc()])).toContain("A title is required.");
  });
  it("requires at least one question", () => {
    expect(validateQuizForSubmit("Week 5", [])).toContain(
      "Add at least one question.",
    );
  });
  it("requires a prompt on every question", () => {
    const out = validateQuizForSubmit("Week 5", [mc({ prompt: "  " })]);
    expect(out.some((m) => m.includes("prompt"))).toBe(true);
  });
  it("requires at least two options on a multiple-choice question", () => {
    const out = validateQuizForSubmit("Week 5", [
      mc({ options: [{ text: "4", isCorrect: true }] }),
    ]);
    expect(out.some((m) => m.includes("two options"))).toBe(true);
  });
  it("requires exactly one correct option", () => {
    const none = validateQuizForSubmit("Week 5", [
      mc({ options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: false }] }),
    ]);
    expect(none.some((m) => m.includes("one correct"))).toBe(true);
    const two = validateQuizForSubmit("Week 5", [
      mc({ options: [{ text: "3", isCorrect: true }, { text: "4", isCorrect: true }] }),
    ]);
    expect(two.some((m) => m.includes("one correct"))).toBe(true);
  });
  it("requires non-empty option text", () => {
    const out = validateQuizForSubmit("Week 5", [
      mc({ options: [{ text: "  ", isCorrect: true }, { text: "4", isCorrect: false }] }),
    ]);
    expect(out.some((m) => m.includes("empty option"))).toBe(true);
  });
});
