import "server-only";
import { requireRole } from "@/lib/auth";

/**
 * Re-asserts the admin role inside every server action so that even if a
 * non-admin tricked the framework into invoking one, the action still fails.
 */
export async function requireAdmin() {
  return requireRole("admin");
}
