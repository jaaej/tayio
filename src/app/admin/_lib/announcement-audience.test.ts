import { describe, expect, it } from "vitest";
import { audienceLabelMaps, describeAudience, type AudienceRow } from "./announcement-audience";

const labels = audienceLabelMaps({
  subjects: [{ id: "s1", name: "Maths", yearLevel: "9" }],
  classes: [{ id: "c1", name: "Saturday AM", subjectName: "Year 9 Maths" }],
  tutors: [{ id: "t1", firstName: "Tom", lastName: "Tutor" }],
});

const row = (over: Partial<AudienceRow>): AudienceRow => ({
  audienceRole: null,
  audienceClassId: null,
  className: null,
  subjectName: null,
  targetRoles: [],
  targetSubjectIds: [],
  targetYearLevels: [],
  targetClassIds: [],
  targetTutorIds: [],
  includeLinkedParents: false,
  ...over,
});

describe("describeAudience", () => {
  it("names a targeted announcement's audience instead of Everyone", () => {
    expect(
      describeAudience(row({ targetRoles: ["parent"], targetClassIds: ["c1"] }), labels),
    ).toBe("Parent · Classes: Year 9 Maths · Saturday AM");
  });

  it("reads older announcements from their single audience fields", () => {
    expect(describeAudience(row({ audienceRole: "tutor" }), labels)).toBe("All tutors");
    expect(
      describeAudience(
        row({ audienceClassId: "c1", className: "Tuesday", subjectName: "Y7 Mathematics" }),
        labels,
      ),
    ).toBe("Class · Y7 Mathematics · Tuesday");
    expect(describeAudience(row({}), labels)).toBe("Everyone");
  });

  it("marks a removed class", () => {
    expect(
      describeAudience(row({ targetRoles: ["student"], targetClassIds: ["gone"] }), labels),
    ).toBe("Student · Classes: Removed class");
  });
});
