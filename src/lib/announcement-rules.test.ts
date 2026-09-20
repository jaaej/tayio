import { describe, expect, it } from "vitest";
import {
  announcementHrefForRole,
  targetSummary,
  uniqueValues,
} from "./announcement-rules";

describe("announcement targeting rules", () => {
  it("deduplicates and trims filter values", () => {
    expect(uniqueValues([" Year 9 ", "Year 9", ""])).toEqual(["Year 9"]);
  });

  it("uses role-correct deep links", () => {
    expect(announcementHrefForRole("student_restricted")).toBe("/student");
    expect(announcementHrefForRole("admin_unrestricted")).toBe(
      "/admin/announcements",
    );
  });

  it("describes combined filters", () => {
    expect(
      targetSummary(
        {
          roles: ["student"],
          subjectIds: ["s"],
          yearLevels: ["Year 9"],
          classIds: [],
          tutorIds: [],
          includeLinkedParents: true,
        },
        { subjects: ["English"], years: ["Year 9"] },
      ),
    ).toBe("Student · Subjects: English · Years: Year 9 · Linked parents included");
  });
});
