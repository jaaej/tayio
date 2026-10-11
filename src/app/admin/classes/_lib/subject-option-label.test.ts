import { describe, expect, it } from "vitest";
import { subjectOptionLabel } from "./subject-option-label";

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
