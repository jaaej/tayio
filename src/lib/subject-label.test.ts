import { describe, expect, it } from "vitest";
import { distinctSubjects, subjectOptionLabel } from "./subject-label";

describe("subjectOptionLabel", () => {
  it("never doubles the year prefix", () => {
    expect(subjectOptionLabel({ name: "Maths", yearLevel: "Year 10" })).toBe(
      "Maths (Year 10)",
    );
    expect(subjectOptionLabel({ name: "Maths", yearLevel: "10" })).toBe(
      "Maths (Year 10)",
    );
  });

  it("omits a level the name already carries", () => {
    expect(
      subjectOptionLabel({ name: "Year 10 Maths", yearLevel: "Year 10" }),
    ).toBe("Year 10 Maths");
    expect(subjectOptionLabel({ name: "VCE Physics", yearLevel: "VCE" })).toBe(
      "VCE Physics",
    );
  });

  it("shows the bare name with no level", () => {
    expect(subjectOptionLabel({ name: "Selective", yearLevel: null })).toBe(
      "Selective",
    );
  });
});

describe("distinctSubjects", () => {
  it("keeps one entry per subject id and a bare name when it is unique", () => {
    expect(
      distinctSubjects([
        { id: "a", name: "English", yearLevel: "Year 9" },
        { id: "a", name: "English", yearLevel: "Year 9" },
      ]).map((s) => s.label),
    ).toEqual(["English"]);
  });

  it("adds the year level only where two subjects share a name", () => {
    expect(
      distinctSubjects([
        { id: "a", name: "Mathematics", yearLevel: "Year 9" },
        { id: "b", name: "Mathematics", yearLevel: "Year 10" },
        { id: "c", name: "English", yearLevel: "Year 9" },
      ]).map((s) => [s.id, s.label]),
    ).toEqual([
      ["c", "English"],
      ["b", "Mathematics (Year 10)"],
      ["a", "Mathematics (Year 9)"],
    ]);
  });
});
