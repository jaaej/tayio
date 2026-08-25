import type { UserRole } from "@/db/schema";
import { coarseRole } from "./roles";

/**
 * Tabs on /admin/users/[id]. Pure so the tab bar, the page and the tests
 * agree on one list, and so an unknown or wrong-role ?tab= has one defined
 * fallback rather than an empty panel.
 */
export type UserTab =
  | "profile"
  | "lessons"
  | "credits"
  | "reports"
  | "tutor"
  | "availability";

type Tab = { key: UserTab; label: string };

const PROFILE: Tab = { key: "profile", label: "Profile" };

const STUDENT_TABS: ReadonlyArray<Tab> = [
  PROFILE,
  { key: "lessons", label: "Lessons & leave" },
  { key: "credits", label: "Credits & activity" },
  { key: "reports", label: "Term reports" },
];

const TUTOR_TABS: ReadonlyArray<Tab> = [
  PROFILE,
  { key: "tutor", label: "Tutor" },
  { key: "availability", label: "Availability" },
];

/** Sections this role's record actually has. One entry means no tab bar. */
export function tabsForRole(role: UserRole): ReadonlyArray<Tab> {
  const coarse = coarseRole(role);
  if (coarse === "student") return STUDENT_TABS;
  if (coarse === "tutor") return TUTOR_TABS;
  return [PROFILE];
}

export function parseTabParam(
  value: string | undefined,
  role: UserRole,
): UserTab {
  const hit = tabsForRole(role).find((tab) => tab.key === value);
  return hit ? hit.key : "profile";
}
