import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/db/schema";
import { coarseRole, isCoarseRole, isUnrestrictedAdmin } from "@/lib/roles";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Does `userRole` satisfy the `accept` spec? A coarse literal ("admin" /
 * "student") in `accept` matches any tier in that family, so existing
 * `requireRole("admin")` / `requireRole("student")` call sites keep working
 * after the tier migration. Tiered/exact values match literally.
 */
function roleMatches(userRole: UserRole, accept: UserRole | UserRole[]): boolean {
  const list = Array.isArray(accept) ? accept : [accept];
  return list.some(
    (a) => a === userRole || (isCoarseRole(a) && coarseRole(userRole) === a),
  );
}

export async function requireRole(accept: UserRole | UserRole[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Role is read ONLY from app_metadata - it's server-only and the source of
  // truth. user_metadata is user-mutable via supabase.auth.updateUser(), so it
  // must never be trusted for authorization. Migration 0002 backfilled every
  // user's app_metadata.role (verified 0 missing), so no fallback is needed.
  const userRole = user.app_metadata?.role as UserRole | undefined;
  if (!userRole || !roleMatches(userRole, accept)) redirect("/login");
  return user;
}

/**
 * Guard for unrestricted-student-only pages/actions (own invoices, DM admin,
 * ...). Accepts any student tier first, then redirects a restricted student
 * back to their dashboard. See the role-tiers spec.
 */
export async function requireUnrestrictedStudent() {
  const user = await requireRole("student");
  const role = user.app_metadata?.role as UserRole | undefined;
  if (role !== "student_unrestricted") redirect("/student");
  return user;
}

/**
 * Guard for owner-only admin pages (revenue, PIN/settings, role management).
 * Accepts any admin tier first, then sends a restricted (reception) admin back
 * to the admin dashboard. See the admin-tier matrix in docs/checklist.md.
 */
export async function requireUnrestrictedAdmin() {
  const user = await requireRole("admin");
  const role = user.app_metadata?.role as UserRole | undefined;
  if (!isUnrestrictedAdmin(role)) redirect("/admin");
  return user;
}
