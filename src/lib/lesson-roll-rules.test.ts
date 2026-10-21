import { describe, expect, it } from "vitest";
import { moveReasons, rollMemberIds } from "./lesson-roll-rules";

const sources = { classRoster: ["isla", "lucas", "chloe"], booked: [], marked: [] };

describe("rollMemberIds", () => {
  it("puts the class on a weekly lesson's roll", () => {
    expect([...rollMemberIds("upcoming", sources)]).toEqual(["isla", "lucas", "chloe"]);
  });

  it("keeps a make-up lesson to its booked students, marked or not", () => {
    expect([...rollMemberIds("makeup", { ...sources, booked: ["chloe"] })]).toEqual(["chloe"]);
  });

  it("adds students booked or marked, once each", () => {
    expect([
      ...rollMemberIds("completed", { classRoster: ["isla"], booked: ["noah"], marked: ["noah", "sam"] }),
    ]).toEqual(["isla", "noah", "sam"]);
  });
});

describe("moveReasons", () => {
  it("takes each student's reason from the move first, then the cancellation, credit, move in", () => {
    const reasons = moveReasons({
      movedOut: [{ studentId: "isla", reason: "Family trip" }],
      cancelled: [
        { studentId: "isla", reason: "Not this one" },
        { studentId: "lucas", reason: " Sick " },
      ],
      credited: [
        { studentId: "lucas", reason: "Nor this" },
        { studentId: "chloe", reason: "No slot that week" },
      ],
      movedIn: [{ studentId: "noah", reason: "Swapped days" }],
    });
    expect(Object.fromEntries(reasons)).toEqual({
      isla: "Family trip",
      lucas: "Sick",
      chloe: "No slot that week",
      noah: "Swapped days",
    });
  });

  it("leaves out blank reasons", () => {
    const reasons = moveReasons({
      movedOut: [{ studentId: "isla", reason: "  " }],
      cancelled: [{ studentId: "isla", reason: null }],
      credited: [],
      movedIn: [],
    });
    expect(reasons.size).toBe(0);
  });
});
