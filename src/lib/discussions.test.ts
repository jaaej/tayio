import { describe, expect, it } from "vitest";
import { threadIsOnBoard } from "./discussions";

describe("threadIsOnBoard", () => {
  const subjectBoard = { kind: "subject" as const, subjectId: "s1" };

  it("accepts a thread on its own subject board", () => {
    expect(threadIsOnBoard("s1", subjectBoard)).toBe(true);
  });

  it("refuses a thread from another subject", () => {
    expect(threadIsOnBoard("s2", subjectBoard)).toBe(false);
  });

  it("refuses an admin-board thread opened under a subject board", () => {
    expect(threadIsOnBoard(null, subjectBoard)).toBe(false);
  });

  it("keeps the admin board to subject-less threads", () => {
    expect(threadIsOnBoard(null, { kind: "admin" })).toBe(true);
    expect(threadIsOnBoard("s1", { kind: "admin" })).toBe(false);
  });
});
