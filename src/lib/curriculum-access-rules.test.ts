import { describe, expect, it } from "vitest";
import {
  filterAccessibleTerms,
  findCurriculumEntryTerm,
  releasedCurriculumWeek,
  type CurriculumAccessTerm,
} from "./curriculum-access-rules";

const terms: CurriculumAccessTerm[] = [
  {
    id: "t3",
    year: 2026,
    termNumber: 3,
    startDate: "2026-07-13",
    endDate: "2026-09-18",
  },
  {
    id: "t2",
    year: 2026,
    termNumber: 2,
    startDate: "2026-04-20",
    endDate: "2026-06-26",
  },
  {
    id: "t4",
    year: 2026,
    termNumber: 4,
    startDate: "2026-10-05",
    endDate: "2026-12-18",
  },
];

describe("curriculum term access", () => {
  it("starts access at the term in which the student enrolled", () => {
    expect(findCurriculumEntryTerm(terms, "2026-08-01")?.id).toBe("t3");
    expect(
      filterAccessibleTerms(
        terms,
        "2026-08-01",
        new Set(),
        "2026-09-01",
      ).map((term) => term.id),
    ).toEqual(["t3"]);
  });

  it("uses the next term when enrolment happens during a holiday", () => {
    expect(findCurriculumEntryTerm(terms, "2026-07-01")?.id).toBe("t3");
  });

  it("allows an admin-granted earlier term but not a future term", () => {
    expect(
      filterAccessibleTerms(
        terms,
        "2026-08-01",
        new Set(["t2"]),
        "2026-09-01",
      ).map((term) => term.id),
    ).toEqual(["t3", "t2"]);
  });
});
describe("weekly curriculum release", () => {
  const term = { startDate: "2026-07-13", endDate: "2026-09-18" };

  it("locks all weeks before a term starts", () => {
    expect(releasedCurriculumWeek(term, 10, "2026-07-12")).toBe(0);
  });

  it("releases one week at a time", () => {
    expect(releasedCurriculumWeek(term, 10, "2026-07-13")).toBe(1);
    expect(releasedCurriculumWeek(term, 10, "2026-07-20")).toBe(2);
  });

  it("fully releases a completed term", () => {
    expect(releasedCurriculumWeek(term, 10, "2026-09-19")).toBe(10);
  });
});
