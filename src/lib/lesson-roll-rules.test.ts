import { describe, expect, it } from "vitest";
import { rollMemberIds } from "./lesson-roll-rules";

const sources = { classRoster: ["isla", "lucas", "chloe"], movedIn: [], marked: [] };

describe("rollMemberIds", () => {
  it("puts the class on a weekly lesson's roll", () => {
    expect([...rollMemberIds("upcoming", sources)]).toEqual(["isla", "lucas", "chloe"]);
  });

  it("keeps a make-up lesson to its booked students", () => {
    expect([...rollMemberIds("makeup", { ...sources, marked: ["chloe"] })]).toEqual(["chloe"]);
  });

  it("adds students moved in or marked, once each", () => {
    expect([
      ...rollMemberIds("completed", { classRoster: ["isla"], movedIn: ["noah"], marked: ["noah", "sam"] }),
    ]).toEqual(["isla", "noah", "sam"]);
  });
});
