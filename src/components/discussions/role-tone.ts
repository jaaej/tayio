import type { UserRole } from "@/db/schema";
import { formatDateShort } from "@/lib/format";
import { coarseRole, type CoarseRole } from "@/lib/roles";
import { melbourneDate } from "@/lib/tutor-cover-rules";

// Avatar / role-pill colours per author role, as token classes so each
// portal's own theme still applies. Tiered roles (admin_unrestricted,
// student_restricted, ...) collapse to their family first.
const ROLE_TONE: Record<CoarseRole, string> = {
  student: "bg-brand-100 text-brand-600",
  tutor: "bg-good-bg text-good",
  parent: "bg-info-bg text-info",
  admin: "bg-warn-bg text-warn",
};

const ROLE_LABEL: Record<CoarseRole, string> = {
  student: "Student",
  tutor: "Tutor",
  parent: "Parent",
  admin: "Admin",
};

export function roleTone(role: UserRole): string {
  return ROLE_TONE[coarseRole(role)] ?? ROLE_TONE.student;
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABEL[coarseRole(role)] ?? "Member";
}

/**
 * The tag on a reply. A tutor's reply reads "Tutor answer" in every role's
 * view, so students can tell at a glance which answers they can rely on.
 */
export function replyRoleLabel(role: UserRole): string {
  return coarseRole(role) === "tutor" ? "Tutor answer" : roleLabel(role);
}

// Tutors and admins give authoritative answers - their replies get highlighted.
export function isStaffRole(role: UserRole): boolean {
  const coarse = coarseRole(role);
  return coarse === "tutor" || coarse === "admin";
}

export function relativeShort(d: Date, now: Date = new Date()): string {
  const ms = now.getTime() - d.getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(ms / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  // Fixed month names: Safari's Intl writes "Sep" where the server writes
  // "Sept", which broke hydration in the client reply list.
  return formatDateShort(melbourneDate(d));
}

// Discussions exist for students, tutors and admins (parents have no board).
export type DiscussionRole = "student" | "tutor" | "admin";
