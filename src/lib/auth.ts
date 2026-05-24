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
  const userRole = (user.user_metadata?.role ?? user.app_metadata?.role) as
    | UserRole
    | undefined;
  if (userRole !== role) redirect("/login");
  return user;
}
