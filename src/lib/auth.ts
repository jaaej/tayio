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
  // Role is read ONLY from app_metadata — it's server-only and the source of
  // truth. user_metadata is user-mutable via supabase.auth.updateUser(), so it
  // must never be trusted for authorization. Migration 0002 backfilled every
  // user's app_metadata.role (verified 0 missing), so no fallback is needed.
  const userRole = user.app_metadata?.role as UserRole | undefined;
  if (userRole !== role) redirect("/login");
  return user;
}
