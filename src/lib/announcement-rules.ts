import { coarseRole, type CoarseRole } from "@/lib/roles";
import type { UserRole } from "@/db/schema";

export const ANNOUNCEMENT_ROLES = [
  "student",
  "parent",
  "tutor",
  "admin",
] as const satisfies readonly CoarseRole[];

export type AnnouncementTargetRules = {
  roles: CoarseRole[];
  subjectIds: string[];
  yearLevels: string[];
  classIds: string[];
  tutorIds: string[];
  includeLinkedParents: boolean;
};

export function uniqueValues(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export function announcementHrefForRole(role: UserRole): string {
  switch (coarseRole(role)) {
    case "admin":
      return "/admin/announcements";
    case "tutor":
      return "/tutor/notifications";
    case "parent":
      return "/parent";
    default:
      return "/student";
  }
}

export function targetSummary(
  rules: AnnouncementTargetRules,
  labels: {
    subjects?: string[];
    years?: string[];
    classes?: string[];
    tutors?: string[];
  } = {},
): string {
  const parts = [
    rules.roles.length === ANNOUNCEMENT_ROLES.length
      ? "Everyone"
      : rules.roles.map(capitalize).join(", "),
    labels.subjects?.length ? `Subjects: ${labels.subjects.join(", ")}` : "",
    labels.years?.length ? `Years: ${labels.years.join(", ")}` : "",
    labels.classes?.length ? `Classes: ${labels.classes.join(", ")}` : "",
    labels.tutors?.length ? `Tutors: ${labels.tutors.join(", ")}` : "",
    rules.includeLinkedParents ? "Linked parents included" : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
