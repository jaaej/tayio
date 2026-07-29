import type { UserRole } from "@/db/schema";

/**
 * Canonical pair ordering - smaller UUID becomes userAId, larger becomes userBId.
 * Ensures there is only one row per pair in dm_threads regardless of who started.
 */
export function canonicalPair(
  x: string,
  y: string,
): { userAId: string; userBId: string } {
  return x < y ? { userAId: x, userBId: y } : { userAId: y, userBId: x };
}

export const DM_ROLES: ReadonlyArray<UserRole> = [
  "parent",
  "student",
  "tutor",
  "admin",
] as const;
