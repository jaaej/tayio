import { describe, expect, it } from "vitest";
import { homeworkSolutionIsAvailable } from "./homework-solution";

describe("homeworkSolutionIsAvailable", () => {
  const dueDate = new Date("2026-10-08T10:00:00.000Z");

  it("keeps a solution hidden before the due date", () => {
    expect(
      homeworkSolutionIsAvailable({
        solutionUrl: "solutions/homework/answer.pdf",
        dueDate,
        now: new Date("2026-10-08T09:59:59.999Z"),
      }),
    ).toBe(false);
  });

  it("releases a solution at the due date", () => {
    expect(
      homeworkSolutionIsAvailable({
        solutionUrl: "solutions/homework/answer.pdf",
        dueDate,
        now: dueDate,
      }),
    ).toBe(true);
  });

  it("does not expose a missing solution after the due date", () => {
    expect(
      homeworkSolutionIsAvailable({
        solutionUrl: null,
        dueDate,
        now: new Date("2026-10-09T10:00:00.000Z"),
      }),
    ).toBe(false);
  });
});
