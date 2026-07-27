import { describe, it, expect } from "vitest";
import {
  gradeQuizAnswers,
  validateQuizForSubmit,
  type QuizItemInput,
  type QuizLeafInput,
} from "./quiz-validation";

const goodLeaf = (): QuizLeafInput => ({
  type: "multiple_choice",
  prompt: "What is 2 + 2?",
  options: [
    { text: "4", isCorrect: true },
    { text: "5", isCorrect: false },
  ],
});

describe("validateQuizForSubmit - context sets", () => {
  it("accepts a valid context set with a passage and one good sub-question", () => {
    const items: QuizItemInput[] = [
      { type: "context", prompt: "Read this passage.", children: [goodLeaf()] },
    ];
    expect(validateQuizForSubmit("Title", items)).toEqual([]);
  });

  it("rejects a context set with an empty passage", () => {
    const items: QuizItemInput[] = [
      { type: "context", prompt: "   ", children: [goodLeaf()] },
    ];
    expect(validateQuizForSubmit("Title", items)).toContain(
      "Context set 1: passage text is required.",
    );
  });

  it("rejects a context set with no sub-questions", () => {
    const items: QuizItemInput[] = [
      { type: "context", prompt: "Passage.", children: [] },
    ];
    expect(validateQuizForSubmit("Title", items)).toContain(
      "Context set 1: needs at least one sub-question.",
    );
  });

  it("reports a bad sub-question with a nested label", () => {
    const items: QuizItemInput[] = [
      {
        type: "context",
        prompt: "Passage.",
        children: [
          {
            type: "multiple_choice",
            prompt: "",
            options: [
              { text: "a", isCorrect: true },
              { text: "b", isCorrect: false },
            ],
          },
        ],
      },
    ];
    expect(validateQuizForSubmit("Title", items)).toContain(
      "Context set 1, sub-question 1: prompt is required.",
    );
  });

  it("requires at least one gradable question overall", () => {
    const items: QuizItemInput[] = [];
    expect(validateQuizForSubmit("Title", items)).toContain(
      "Add at least one question.",
    );
  });

  it("still validates a top-level leaf question", () => {
    const items: QuizItemInput[] = [
      { type: "multiple_choice", prompt: "Q", options: [{ text: "a", isCorrect: false }] },
    ];
    const problems = validateQuizForSubmit("Title", items);
    expect(problems).toContain("Question 1: needs at least two options.");
    expect(problems).toContain("Question 1: must have exactly one correct option.");
  });
});

describe("gradeQuizAnswers", () => {
  const keys = [
    {
      questionId: "q1",
      optionIds: ["q1-a", "q1-b"],
      correctOptionId: "q1-b",
    },
    {
      questionId: "q2",
      optionIds: ["q2-a", "q2-b"],
      correctOptionId: "q2-a",
    },
  ];

  it("grades a complete practice attempt", () => {
    const result = gradeQuizAnswers(keys, [
      { questionId: "q1", optionId: "q1-b" },
      { questionId: "q2", optionId: "q2-b" },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.grade.correctCount).toBe(1);
      expect(result.grade.total).toBe(2);
    }
  });

  it("requires every question to be answered", () => {
    expect(
      gradeQuizAnswers(keys, [{ questionId: "q1", optionId: "q1-b" }]),
    ).toEqual({
      ok: false,
      error: "Answer every question before checking your quiz.",
    });
  });

  it("rejects an option from another question", () => {
    expect(
      gradeQuizAnswers(keys, [
        { questionId: "q1", optionId: "q2-a" },
        { questionId: "q2", optionId: "q2-b" },
      ]),
    ).toEqual({
      ok: false,
      error: "One or more answers do not belong to this quiz.",
    });
  });

  it("rejects duplicate answers for one question", () => {
    expect(
      gradeQuizAnswers(keys, [
        { questionId: "q1", optionId: "q1-a" },
        { questionId: "q1", optionId: "q1-b" },
      ]),
    ).toEqual({
      ok: false,
      error: "Each question can only have one answer.",
    });
  });
});
