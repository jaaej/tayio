import { describe, it, expect } from "vitest";
import {
  adminTier,
  isUnrestrictedAdmin,
  isUnrestrictedStudent,
  studentTier,
  coarseRole,
  roleLabel,
  canAdminManageAccount,
  createUserRoleOptions,
  ROLE_OPTIONS,
} from "./roles";

describe("roleLabel", () => {
  it("hides internal student tier names from users", () => {
    expect(roleLabel("student_unrestricted")).toBe("Student");
    expect(roleLabel("student_restricted")).toBe(
      "Student – parental access",
    );
  });
});

describe("adminTier / isUnrestrictedAdmin", () => {
  it("treats admin_restricted as the only restricted admin tier", () => {
    expect(adminTier("admin_restricted")).toBe("restricted");
    expect(isUnrestrictedAdmin("admin_restricted")).toBe(false);
  });

  it("treats admin_unrestricted as unrestricted", () => {
    expect(adminTier("admin_unrestricted")).toBe("unrestricted");
    expect(isUnrestrictedAdmin("admin_unrestricted")).toBe(true);
  });

  it("treats the legacy coarse 'admin' as unrestricted (migration 0018 default)", () => {
    // Legacy admin rows migrated to admin_unrestricted, so a bare 'admin' must
    // never be read as reception - that would silently downgrade an owner.
    expect(adminTier("admin")).toBe("unrestricted");
    expect(isUnrestrictedAdmin("admin")).toBe(true);
  });

  it("never reads a non-admin role as an unrestricted admin", () => {
    for (const role of [
      "tutor",
      "parent",
      "student",
      "student_unrestricted",
      "student_restricted",
    ] as const) {
      expect(isUnrestrictedAdmin(role)).toBe(false);
    }
  });

  it("is safe on null/undefined", () => {
    expect(isUnrestrictedAdmin(null)).toBe(false);
    expect(isUnrestrictedAdmin(undefined)).toBe(false);
    expect(adminTier(null)).toBe("unrestricted");
  });
});

describe("student tier predicates (regression guard)", () => {
  it("only student_unrestricted is unrestricted", () => {
    expect(isUnrestrictedStudent("student_unrestricted")).toBe(true);
    expect(isUnrestrictedStudent("student_restricted")).toBe(false);
    expect(isUnrestrictedStudent("student")).toBe(false);
    expect(studentTier("student")).toBe("restricted");
  });
});

describe("coarseRole", () => {
  it("collapses both admin tiers to the admin family", () => {
    expect(coarseRole("admin_restricted")).toBe("admin");
    expect(coarseRole("admin_unrestricted")).toBe("admin");
    expect(coarseRole("admin")).toBe("admin");
  });
});

describe("canAdminManageAccount", () => {
  it("prevents reception from changing any admin account", () => {
    expect(
      canAdminManageAccount("admin_restricted", "admin_unrestricted"),
    ).toBe(false);
    expect(
      canAdminManageAccount("admin_restricted", "admin_restricted"),
    ).toBe(false);
  });

  it("lets reception manage operational non-admin accounts", () => {
    expect(canAdminManageAccount("admin_restricted", "student_restricted")).toBe(
      true,
    );
    expect(canAdminManageAccount("admin_restricted", "tutor")).toBe(true);
  });

  it("lets an owner manage admin accounts and rejects non-admin actors", () => {
    expect(
      canAdminManageAccount("admin_unrestricted", "admin_restricted"),
    ).toBe(true);
    expect(canAdminManageAccount("tutor", "student_unrestricted")).toBe(false);
  });
});

describe("createUserRoleOptions", () => {
  it("does not expose tutor or either admin tier to reception", () => {
    expect(createUserRoleOptions(false).map((option) => option.value)).toEqual([
      "student_restricted",
      "student_unrestricted",
      "parent",
    ]);
  });

  it("keeps all tiered account roles available to an owner", () => {
    expect(createUserRoleOptions(true)).toEqual(ROLE_OPTIONS);
  });
});
