import { describe, expect, it } from "vitest";
import { formatQuizWeekLabel } from "./quiz-status";

describe("formatQuizWeekLabel", () => {
  it("distinguishes the same week number in different terms", () => {
    const termOne = formatQuizWeekLabel({
      subjectName: "Year 9 English",
      year: 2026,
      termNumber: 1,
      weekNumber: 1,
    });
    const termTwo = formatQuizWeekLabel({
      subjectName: "Year 9 English",
      year: 2026,
      termNumber: 2,
      weekNumber: 1,
    });

    expect(termOne).toBe("Year 9 English - 2026 Term 1, Week 1");
    expect(termTwo).toBe("Year 9 English - 2026 Term 2, Week 1");
    expect(termOne).not.toBe(termTwo);
  });
});
