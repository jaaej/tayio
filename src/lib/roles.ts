import type { UserRole } from "@/db/schema";

/**
 * Role tiering (spec: docs/superpowers/specs/2026-07-09-student-role-tiers-design.md).
 *
 * The DB enum carries both the four legacy "coarse" values (student, parent,
 * tutor, admin) and the tiered account roles (student_restricted,
 * student_unrestricted, admin_restricted, admin_unrestricted). After migration
 * 0018 every ACCOUNT carries a tiered role; the coarse values survive only as
 * (a) announcement audience targets and (b) DM/discussion display prefixes.
 *
 * `coarseRole` collapses any tiered role back to its family so the ~40 existing
 * coarse comparisons (`role === "student"`, `eq(profiles.role, "admin")`, ...)
 * keep working. Use the tier-aware predicates only where a feature actually
 * differs between tiers.
 */

export type CoarseRole = "admin" | "student" | "tutor" | "parent";

export const ADMIN_TIERS = [
  "admin_unrestricted",
  "admin_restricted",
] as const satisfies readonly UserRole[];

export const STUDENT_TIERS = [
  "student_unrestricted",
  "student_restricted",
] as const satisfies readonly UserRole[];

/** Collapse a (possibly tiered) role to its coarse family. */
export function coarseRole(role: UserRole): CoarseRole {
  if (role.startsWith("admin")) return "admin";
  if (role.startsWith("student")) return "student";
  return role as "tutor" | "parent";
}

/** True for the two coarse role literals that expand to a tier family. */
export function isCoarseRole(role: UserRole): boolean {
  return role === "admin" || role === "student";
}

/**
 * A student's tier. Only the explicit `student_unrestricted` value is
 * unrestricted; the legacy `student` and `student_restricted` both mean
 * parent-dependent, so `restricted` is the safe default.
 */
export function studentTier(role: UserRole): "restricted" | "unrestricted" {
  return role === "student_unrestricted" ? "unrestricted" : "restricted";
}

export function isUnrestrictedStudent(
  role: UserRole | null | undefined,
): boolean {
  return role === "student_unrestricted";
}

/**
 * Assignable account roles for the admin user-management forms, with
 * human-readable labels. Only tiered values are offered — new/edited accounts
 * should always carry a tier, never a bare coarse role.
 */
export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "student_restricted", label: "Student — restricted" },
  { value: "student_unrestricted", label: "Student — unrestricted" },
  { value: "parent", label: "Parent" },
  { value: "tutor", label: "Tutor" },
  { value: "admin_restricted", label: "Admin — reception" },
  { value: "admin_unrestricted", label: "Admin — owner" },
];
