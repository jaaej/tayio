import { describe, it, expect } from "vitest";
import {
  gradeTermTest,
  deriveTermTestState,
  rankTermTestBoard,
} from "./term-test";

const keys = [
  { questionId: "q1", optionIds: ["a", "b"], correctOptionId: "a" },
  { questionId: "q2", optionIds: ["c", "d"], correctOptionId: "d" },
];

describe("gradeTermTest", () => {
  it("scores correct answers and counts unanswered as wrong", () => {
    const r = gradeTermTest(keys, [{ questionId: "q1", optionId: "a" }]);
    expect(r).toEqual({
      ok: true,
      score: 1,
      total: 2,
      graded: [
        { questionId: "q1", selectedOptionId: "a", correctOptionId: "a", isCorrect: true },
        { questionId: "q2", selectedOptionId: null, correctOptionId: "d", isCorrect: false },
      ],
    });
  });

  it("gives full marks when all correct", () => {
    const r = gradeTermTest(keys, [
      { questionId: "q1", optionId: "a" },
      { questionId: "q2", optionId: "d" },
    ]);
    expect(r.ok && r.score).toBe(2);
    expect(r.ok && r.total).toBe(2);
  });

  it("gives zero when all wrong", () => {
    const r = gradeTermTest(keys, [
      { questionId: "q1", optionId: "b" },
      { questionId: "q2", optionId: "c" },
    ]);
    expect(r.ok && r.score).toBe(0);
  });

  it("rejects two answers for one question", () => {
    const r = gradeTermTest(keys, [
      { questionId: "q1", optionId: "a" },
      { questionId: "q1", optionId: "b" },
    ]);
    expect(r.ok).toBe(false);
  });

  it("rejects an option that does not belong to the question", () => {
    const r = gradeTermTest(keys, [{ questionId: "q1", optionId: "zzz" }]);
    expect(r.ok).toBe(false);
  });

  it("rejects an answer for an unknown question", () => {
    const r = gradeTermTest(keys, [{ questionId: "qX", optionId: "a" }]);
    expect(r.ok).toBe(false);
  });

  it("rejects a valid option from one question submitted against another", () => {
    const r = gradeTermTest(keys, [{ questionId: "q1", optionId: "c" }]);
    expect(r.ok).toBe(false);
  });
});

describe("deriveTermTestState", () => {
  const base = { resultsReleaseAt: new Date("2026-08-01T00:00:00Z") };
  it("is not_open until approved", () => {
    expect(
      deriveTermTestState({ ...base, status: "pending_review", now: new Date("2026-07-01"), hasAttempt: false }),
    ).toBe("not_open");
  });
  it("is open when approved, before release, no attempt", () => {
    expect(
      deriveTermTestState({ ...base, status: "approved", now: new Date("2026-07-15"), hasAttempt: false }),
    ).toBe("open");
  });
  it("is submitted_pending when attempted and before release", () => {
    expect(
      deriveTermTestState({ ...base, status: "approved", now: new Date("2026-07-15"), hasAttempt: true }),
    ).toBe("submitted_pending");
  });
  it("is released at/after the release date regardless of attempt", () => {
    expect(
      deriveTermTestState({ ...base, status: "approved", now: new Date("2026-08-02"), hasAttempt: false }),
    ).toBe("released");
    expect(
      deriveTermTestState({ ...base, status: "approved", now: new Date("2026-08-02"), hasAttempt: true }),
    ).toBe("released");
  });

  it("is released at exact boundary when now equals resultsReleaseAt", () => {
    const releaseTime = new Date("2026-08-01T00:00:00Z");
    expect(
      deriveTermTestState({ resultsReleaseAt: releaseTime, status: "approved", now: releaseTime, hasAttempt: false }),
    ).toBe("released");
  });

  it("is released and overrides a non-approved status", () => {
    expect(
      deriveTermTestState({ ...base, status: "pending_review", now: new Date("2026-08-02"), hasAttempt: false }),
    ).toBe("released");
  });
});

describe("rankTermTestBoard", () => {
  const cohort = [
    { studentId: "s1", firstName: "Ada", lastName: "Lovelace" },
    { studentId: "s2", firstName: "Alan", lastName: "Turing" },
    { studentId: "s3", firstName: "Grace", lastName: null },
  ];
  it("ranks by score desc, no-shows at zero last, masks names", () => {
    const { top } = rankTermTestBoard(
      cohort,
      [
        { studentId: "s1", score: 8, submittedAt: new Date("2026-07-10") },
        { studentId: "s2", score: 5, submittedAt: new Date("2026-07-11") },
      ],
      "s2",
    );
    expect(top.map((r) => [r.rank, r.name, r.score, r.isMe])).toEqual([
      [1, "Ada L.", 8, false],
      [2, "Alan T.", 5, true],
      [3, "Grace", 0, false],
    ]);
  });
  it("surfaces a me row only when outside the top N", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      studentId: `s${i}`,
      firstName: `Name${i}`,
      lastName: "X",
    }));
    const attempts = many.map((m, i) => ({
      studentId: m.studentId,
      score: 100 - i,
      submittedAt: new Date("2026-07-10"),
    }));
    const { top, me } = rankTermTestBoard(many, attempts, "s24", { topN: 20 });
    expect(top).toHaveLength(20);
    expect(me?.isMe).toBe(true);
    expect(me?.rank).toBe(25);
  });

  it("me is null when the viewer is inside the top N", () => {
    expect(rankTermTestBoard(cohort, [
      { studentId: "s1", score: 8, submittedAt: new Date("2026-07-10") },
      { studentId: "s2", score: 5, submittedAt: new Date("2026-07-11") },
    ], "s2").me).toBe(null);
  });

  it("0-score submitter ranks above a no-show in tie-break", () => {
    const cohort2 = [
      { studentId: "s1", firstName: "Alice", lastName: "Smith" },
      { studentId: "s2", firstName: "Bob", lastName: "Jones" },
    ];
    const { top } = rankTermTestBoard(
      cohort2,
      [
        { studentId: "s1", score: 0, submittedAt: new Date("2026-07-10") },
      ],
      "s1",
    );
    expect(top.map((r) => [r.rank, r.score])).toEqual([
      [1, 0],
      [2, 0],
    ]);
    expect(top[0].name).toMatch(/^Alice/);
    expect(top[1].name).toMatch(/^Bob/);
  });
});
