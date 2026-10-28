import { describe, expect, it } from "vitest";
import { averageScore } from "./score-average";

describe("averageScore", () => {
  it("weighs each homework and quiz equally", () => {
    // 80, 90 and a quiz at 7/10 = 70 -> 80
    const avg = averageScore(["80", 90], [{ correctCount: 7, total: 10 }]);
    expect(avg).toEqual({ percent: 80, homeworkCount: 2, quizCount: 1 });
  });

  it("ignores unscored homework and empty quizzes", () => {
    expect(
      averageScore([null, "", "75"], [{ correctCount: 0, total: 0 }]),
    ).toEqual({ percent: 75, homeworkCount: 1, quizCount: 0 });
  });

  it("is null when nothing is marked", () => {
    expect(averageScore([], []).percent).toBeNull();
  });

  it("rounds to a whole percent", () => {
    expect(averageScore([], [{ correctCount: 2, total: 3 }]).percent).toBe(67);
  });
});
