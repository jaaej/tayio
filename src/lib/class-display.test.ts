import { describe, expect, it } from "vitest";
import { classDisplayName, classNameDetail } from "./class-display";

describe("class display labels", () => {
  it("does not repeat a subject already at the start of a class name", () => {
    expect(
      classDisplayName("Year 9 English", "Year 9 English · Tuesday PM"),
    ).toBe("Year 9 English · Tuesday PM");
  });

  it("removes repeated legacy subject prefixes", () => {
    expect(
      classDisplayName(
        "Year 9 English",
        "Year 9 English · Year 9 English · Tuesday PM",
      ),
    ).toBe("Year 9 English · Tuesday PM");
  });

  it("removes shortened VCE subject aliases used by existing class records", () => {
    expect(
      classDisplayName("VCE Specialist Maths", "VCE Specialist · Sunday PM"),
    ).toBe("VCE Specialist Maths · Sunday PM");
    expect(
      classDisplayName("VCE Maths Methods", "VCE Methods · Sunday AM"),
    ).toBe("VCE Maths Methods · Sunday AM");
  });

  it("matches prefixes without depending on letter case", () => {
    expect(classDisplayName("Year 9 English", "year 9 english - Saturday")).toBe(
      "Year 9 English · Saturday",
    );
  });

  it("keeps unrelated class names and partial word matches", () => {
    expect(classDisplayName("English", "Tuesday PM")).toBe(
      "English · Tuesday PM",
    );
    expect(classDisplayName("Math", "Mathematics Extension")).toBe(
      "Math · Mathematics Extension",
    );
  });

  it("returns only the remaining class detail when the subject is elsewhere", () => {
    expect(classNameDetail("Year 10 Maths", "Year 10 Maths · Monday PM")).toBe(
      "Monday PM",
    );
    expect(classNameDetail("Year 10 Maths", "Year 10 Maths")).toBe("");
  });

  it("handles missing values", () => {
    expect(classDisplayName("Year 11 Methods", null)).toBe("Year 11 Methods");
    expect(classDisplayName(null, "Thursday PM")).toBe("Thursday PM");
  });
});
