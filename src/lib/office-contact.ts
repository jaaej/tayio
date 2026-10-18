import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { ADMIN_TIERS } from "@/lib/roles";

export type OfficeContact = { id: string; firstName: string; lastName: string };

/**
 * The office a student or parent messages: the longest-standing active
 * admin, so every family page opens the same conversation and a deactivated
 * admin is never offered.
 */
export async function getOfficeContact(): Promise<OfficeContact | null> {
  const [row] = await db
    .select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(and(inArray(profiles.role, ADMIN_TIERS), eq(profiles.isActive, true)))
    .orderBy(asc(profiles.createdAt), asc(profiles.id))
    .limit(1);
  return row ?? null;
}
