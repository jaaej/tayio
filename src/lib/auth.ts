import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/db/schema";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireRole(role: UserRole) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // app_metadata first: it's server-only and the source of truth for role.
  // user_metadata is user-mutable via supabase.auth.updateUser() and only
  // kept as a fallback for any user that predates migration 0002's backfill.
  const userRole = (user.app_metadata?.role ?? user.user_metadata?.role) as
    | UserRole
    | undefined;
  if (userRole !== role) redirect("/login");
  return user;
}
