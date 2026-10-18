import { describe, expect, it } from "vitest";
import {
  announcementHrefForRole,
  announcementIdFromDedupeKey,
  targetSummary,
  uniqueValues,
} from "./announcement-rules";

describe("announcement targeting rules", () => {
  it("deduplicates and trims filter values", () => {
    expect(uniqueValues([" Year 9 ", "Year 9", ""])).toEqual(["Year 9"]);
  });

  it("opens the announcement in each role's inbox", () => {
    expect(announcementHrefForRole("student_restricted")).toBe("/student/notifications");
    expect(announcementHrefForRole("parent")).toBe("/parent/notifications");
    expect(announcementHrefForRole("tutor")).toBe("/tutor/notifications");
    expect(announcementHrefForRole("admin_unrestricted")).toBe("/admin/notifications");
    expect(announcementHrefForRole("parent", "9436371b-4626-49d8-a33e-6f2e078f7f5c")).toBe(
      "/parent/notifications?announcement=9436371b-4626-49d8-a33e-6f2e078f7f5c",
    );
  });

  it("reads the announcement id from a delivery's dedupe key only", () => {
    expect(announcementIdFromDedupeKey("announcement:9436371b-4626-49d8-a33e-6f2e078f7f5c")).toBe(
      "9436371b-4626-49d8-a33e-6f2e078f7f5c",
    );
    expect(announcementIdFromDedupeKey("announcement-approved:9436371b-4626-49d8-a33e-6f2e078f7f5c")).toBeNull();
    expect(announcementIdFromDedupeKey(null)).toBeNull();
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
