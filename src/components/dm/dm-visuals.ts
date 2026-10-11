import type { UserRole } from "@/db/schema";
import { coarseRole } from "@/lib/roles";

/** Initials for an avatar: first and last name initials, uppercased. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * Tinted avatar per role, built from theme tokens so every portal's palette
 * applies: parents info blue, tutors green, admins amber, students brand.
 */
export function roleAvatarClass(role: UserRole): string {
  switch (coarseRole(role)) {
    case "parent":
      return "bg-info-bg text-info";
    case "tutor":
      return "bg-good-bg text-good";
    case "admin":
      return "bg-warn-bg text-warn";
    case "student":
    default:
      return "bg-brand-100 text-brand-600";
  }
}

const SHORT_ROLE_LABEL = {
  admin: "Admin",
  parent: "Parent",
  student: "Student",
  tutor: "Tutor",
} as const;

/** One-word role label for dense rows ("Parent", "Tutor"). */
export function shortRoleLabel(role: UserRole): string {
  return SHORT_ROLE_LABEL[coarseRole(role)];
}
