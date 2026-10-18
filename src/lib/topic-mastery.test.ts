import { describe, expect, it } from "vitest";
import { masteryLevel, meanMastery, topicMastery } from "./topic-mastery";

const topics = [
  { topicId: "alg", name: "Algebra", weekIds: ["w1", "w2"] },
  { topicId: "geo", name: "Geometry", weekIds: ["w3"] },
  { topicId: "stats", name: "Statistics", weekIds: [] },
];

describe("topicMastery", () => {
  it("averages quiz scores and homework marks in the topic's weeks", () => {
    const [alg, geo, stats] = topicMastery(topics, {
      homework: [
        { weekId: "w1", score: "90.00" },
        { weekId: "w3", score: 40 },
        // Homework outside any curriculum week counts for no topic.
        { weekId: null, score: 10 },
      ],
      quizzes: [{ weekId: "w2", correctCount: 7, total: 10 }],
    });
    // (90 + 70) / 2
    expect(alg).toEqual({ topicId: "alg", topic: "Algebra", percent: 80, level: "strong", markCount: 2 });
    expect(geo).toMatchObject({ percent: 40, level: "needs_work", markCount: 1 });
    expect(stats).toMatchObject({ percent: null, level: null, markCount: 0 });
  });

  it("has no mastery, not 0%, before anything is marked", () => {
    expect(topicMastery(topics, { homework: [], quizzes: [] }).every((t) => t.percent === null)).toBe(true);
  });

  it("ignores a quiz with no questions", () => {
    const [alg] = topicMastery(topics, {
      homework: [],
      quizzes: [{ weekId: "w1", correctCount: 0, total: 0 }],
    });
    expect(alg.percent).toBeNull();
  });
});

describe("masteryLevel", () => {
  it("reads 80+ as strong, 60+ as improving, below as needs work", () => {
    expect(masteryLevel(80)).toBe("strong");
    expect(masteryLevel(79)).toBe("improving");
    expect(masteryLevel(60)).toBe("improving");
    expect(masteryLevel(59)).toBe("needs_work");
  });
});

describe("meanMastery", () => {
  it("averages only the parts with marks", () => {
    expect(meanMastery([{ percent: 80 }, { percent: null }, { percent: 41 }])).toBe(61);
    expect(meanMastery([{ percent: null }])).toBeNull();
    expect(meanMastery([])).toBeNull();
  });
});
