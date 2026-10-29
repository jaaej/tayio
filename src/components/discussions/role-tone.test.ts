import { describe, expect, it } from "vitest";
import {
  isStaffRole,
  relativeShort,
  replyRoleLabel,
  roleLabel,
  roleTone,
} from "./role-tone";

describe("discussion role helpers", () => {
  it("collapses tiered roles to their family", () => {
    expect(roleLabel("admin_unrestricted")).toBe("Admin");
    expect(roleLabel("admin_restricted")).toBe("Admin");
    expect(roleLabel("student_restricted")).toBe("Student");
    expect(roleLabel("tutor")).toBe("Tutor");
    expect(roleTone("admin_restricted")).toBe(roleTone("admin"));
    expect(roleTone("student_unrestricted")).toBe(roleTone("student"));
  });

  it("treats tutors and every admin tier as staff", () => {
    expect(isStaffRole("tutor")).toBe(true);
    expect(isStaffRole("admin_unrestricted")).toBe(true);
    expect(isStaffRole("admin_restricted")).toBe(true);
    expect(isStaffRole("student_unrestricted")).toBe(false);
    expect(isStaffRole("parent")).toBe(false);
  });

  it("tags tutor replies as a tutor answer and leaves other roles plain", () => {
    expect(replyRoleLabel("tutor")).toBe("Tutor answer");
    expect(replyRoleLabel("admin_unrestricted")).toBe("Admin");
    expect(replyRoleLabel("student_restricted")).toBe("Student");
  });

  it("formats recent activity compactly", () => {
    const now = new Date("2026-10-11T10:00:00Z");
    expect(relativeShort(new Date("2026-10-11T09:30:00Z"), now)).toBe("Just now");
    expect(relativeShort(new Date("2026-10-11T07:00:00Z"), now)).toBe("3h ago");
    expect(relativeShort(new Date("2026-10-10T09:00:00Z"), now)).toBe("Yesterday");
    expect(relativeShort(new Date("2026-10-07T10:00:00Z"), now)).toBe("4d ago");
    expect(relativeShort(new Date("2026-09-27T10:00:00Z"), now)).toBe("2w ago");
    // Melbourne's date, past midnight there while still the 31st in UTC.
    expect(relativeShort(new Date("2026-08-31T15:00:00Z"), now)).toBe("1 Sept");
  });
});
