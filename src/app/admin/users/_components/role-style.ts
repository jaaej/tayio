import type { CoarseRole } from "@/lib/roles";

/** Initials-avatar colours per role, shared by the list rows and the profile
 *  header so a person reads the same in both panes. */
export const ROLE_AVATAR = {
  admin: "bg-warn-bg text-warn",
  tutor: "bg-good-bg text-good",
  parent: "bg-info-bg text-info",
  student: "bg-brand-100 text-brand-600",
} as const satisfies Record<CoarseRole, string>;
