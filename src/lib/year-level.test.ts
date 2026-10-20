import { describe, expect, it } from "vitest";
import {
  STUDENT_YEAR_LEVELS,
  canonicalStudentYear,
  parseStudentYear,
  studentYearOptions,
} from "./year-level";

describe("parseStudentYear", () => {
  it("reads the ways year levels were typed before the picker", () => {
    for (const raw of ["10", "Year 10", "year10", "Yr 10", "yr. 10", "Y10", "Grade 10", " Year  10 "]) {
      expect(parseStudentYear(raw)).toBe(10);
    }
  });

  it("reads Prep and Foundation as year 0", () => {
    expect(parseStudentYear("Prep")).toBe(0);
    expect(parseStudentYear("foundation")).toBe(0);
    expect(parseStudentYear("F")).toBe(0);
  });

  it("does not guess at anything else", () => {
    for (const raw of ["VCE", "asdf", "13", "0", "Year 0", "", null, undefined]) {
      expect(parseStudentYear(raw)).toBeNull();
    }
  });
});

describe("canonicalStudentYear", () => {
  it("gives the stored label", () => {
    expect(canonicalStudentYear("7")).toBe("Year 7");
    expect(canonicalStudentYear("Year11")).toBe("Year 11");
    expect(canonicalStudentYear("prep")).toBe("Prep");
    expect(canonicalStudentYear("VCE")).toBeNull();
  });
});

describe("studentYearOptions", () => {
  it("lists Prep to Year 12", () => {
    expect(STUDENT_YEAR_LEVELS[0]).toBe("Prep");
    expect(STUDENT_YEAR_LEVELS.at(-1)).toBe("Year 12");
    expect(STUDENT_YEAR_LEVELS).toHaveLength(13);
  });

  it("keeps a saved value the list does not have", () => {
    expect(studentYearOptions("VCE").at(-1)).toBe("VCE");
    expect(studentYearOptions("Year 10")).toHaveLength(13);
    expect(studentYearOptions(null)).toHaveLength(13);
  });
});
