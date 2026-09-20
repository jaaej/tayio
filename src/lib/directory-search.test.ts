import { describe, expect, it } from "vitest";
import {
  directoryEntryMatches,
  matchingAliasSubjectIds,
  normalizeSubjectAlias,
} from "./directory-search";

const user = {
  firstName: "Sarah",
  lastName: "Student",
  email: "sarah@example.com",
  classInfo: [
    {
      name: "Tuesday PM",
      subjectName: "Year 9 English",
      subjectId: "english-9",
    },
  ],
};

describe("admin directory subject aliases", () => {
  it("normalizes quick keys", () => {
    expect(normalizeSubjectAlias(" E1/2 ")).toBe("e1/2");
  });

  it("matches an exact configured alias", () => {
    const ids = matchingAliasSubjectIds(
      [{ subjectId: "english-9", alias: "e1/2" }],
      "E1/2",
    );
    expect(directoryEntryMatches(user, "e1/2", ids)).toBe(true);
  });

  it("continues matching the original subject and class names", () => {
    const ids = matchingAliasSubjectIds(
      [{ subjectId: "english-9", alias: "e1/2" }],
      "unrelated",
    );
    expect(directoryEntryMatches(user, "Year 9 English", ids)).toBe(true);
    expect(directoryEntryMatches(user, "Tuesday PM", ids)).toBe(true);
  });

  it("does not partially expand a quick key", () => {
    const ids = matchingAliasSubjectIds(
      [{ subjectId: "english-9", alias: "e1/2" }],
      "e1",
    );
    expect(directoryEntryMatches(user, "e1", ids)).toBe(false);
  });
});
