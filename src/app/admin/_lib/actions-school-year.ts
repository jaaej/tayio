"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, schoolYearEnds } from "@/db/schema";
import { DEACTIVATED_BAN_DURATION } from "@/lib/account-ban";
import { isUnrestrictedAdmin } from "@/lib/roles";
import { finalYearStudents, planRollover } from "@/lib/school-year-rules";
import { withActor } from "@/lib/with-actor";
import type { UserRole } from "@/db/schema";
import { requireAdmin } from "./guard";
import {
  activeStudents,
  archiveStudentsInTx,
  getSchoolYearEnd,
  lockSchoolYearEnd,
  mergeIds,
  parentsLeavingWith,
} from "./school-year";
import { createAdminClient } from "./supabase-admin";

const inputSchema = z.object({ schoolYear: z.number().int().min(2000).max(2100) });

export type SchoolYearResult =
  | { ok: true; archived: number; parents: number; moved: number; banFailed: string[] }
  | { ok: false; error: string };

class Refused extends Error {}

/** Owner-level admins only, and only for the school year the Terms page offers. */
async function guard(schoolYear: number, needsTermEnded: boolean) {
  const user = await requireAdmin();
  const role = user.app_metadata?.role as UserRole | undefined;
  if (!isUnrestrictedAdmin(role)) {
    return { error: "Only an owner-level admin can end the school year." } as const;
  }
  const view = await getSchoolYearEnd();
  if (!view || view.year !== schoolYear) {
    return { error: "This school year can't be ended now. Reload the page." } as const;
  }
  if (view.rolledOver) {
    return { error: `Students already moved up a year for ${schoolYear}.` } as const;
  }
  if (needsTermEnded && !view.termEnded) {
    return { error: `Students move up once Term ${view.finalTerm.termNumber} has ended.` } as const;
  }
  return { user } as const;
}

/**
 * Block sign-in for archived accounts. Runs after the database change has
 * committed; an account that fails is named so the admin can deactivate it
 * again from its profile (the sign-in action refuses it meanwhile).
 */
async function banAccounts(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const admin = createAdminClient();
  const results = await Promise.allSettled(
    ids.map((id) => admin.auth.admin.updateUserById(id, { ban_duration: DEACTIVATED_BAN_DURATION })),
  );
  return ids.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" || Boolean(r.value.error);
  });
}

async function namesOf(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(inArray(profiles.id, ids));
  return rows.map((r) => `${r.firstName} ${r.lastName}`.trim());
}

function revalidateSchoolYear() {
  revalidatePath("/admin", "layout");
  revalidatePath("/tutor", "layout");
  revalidatePath("/student", "layout");
  revalidatePath("/parent", "layout");
}

/**
 * Archive every active Year 12 student (and parents left with no active
 * child and nothing to pay), before or as the school year ends.
 */
export async function archiveYear12Students(input: z.input<typeof inputSchema>): Promise<SchoolYearResult> {
  const { schoolYear } = inputSchema.parse(input);
  const checked = await guard(schoolYear, false);
  if ("error" in checked) return { ok: false, error: checked.error ?? "Not allowed." };

  let archivedIds: string[] = [];
  let parentIds: string[] = [];
  try {
    await withActor({ id: checked.user.id, role: "admin" }, async (tx) => {
      const row = await lockSchoolYearEnd(tx, schoolYear);
      if (row.rolledOverAt) throw new Refused(`Students already moved up a year for ${schoolYear}.`);
      archivedIds = finalYearStudents(await activeStudents(tx)).map((s) => s.id);
      if (archivedIds.length === 0) return;
      parentIds = (await parentsLeavingWith(tx, archivedIds)).archive.map((p) => p.id);
      await archiveStudentsInTx(tx, archivedIds, parentIds);
      await tx
        .update(schoolYearEnds)
        .set({
          year12ArchivedAt: new Date(),
          year12ArchivedBy: checked.user.id,
          archivedStudentIds: mergeIds(row.archivedStudentIds, archivedIds),
          archivedParentIds: mergeIds(row.archivedParentIds, parentIds),
        })
        .where(eq(schoolYearEnds.schoolYear, schoolYear));
    });
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.message };
    throw error;
  }

  const banFailed = await namesOf(await banAccounts([...archivedIds, ...parentIds]));
  revalidateSchoolYear();
  return { ok: true, archived: archivedIds.length, parents: parentIds.length, moved: 0, banFailed };
}

/**
 * Move every active student up a year once the year's final term has ended:
 * Year 12s still active are archived (they have finished school), and
 * students with no readable year level are left as they are. Once per
 * school year.
 */
export async function moveStudentsUpAYear(input: z.input<typeof inputSchema>): Promise<SchoolYearResult> {
  const { schoolYear } = inputSchema.parse(input);
  const checked = await guard(schoolYear, true);
  if ("error" in checked) return { ok: false, error: checked.error ?? "Not allowed." };

  let archivedIds: string[] = [];
  let parentIds: string[] = [];
  let moved = 0;
  try {
    await withActor({ id: checked.user.id, role: "admin" }, async (tx) => {
      const row = await lockSchoolYearEnd(tx, schoolYear);
      if (row.rolledOverAt) throw new Refused(`Students already moved up a year for ${schoolYear}.`);
      const plan = planRollover(await activeStudents(tx));

      archivedIds = plan.finishing.map((s) => s.id);
      parentIds = (await parentsLeavingWith(tx, archivedIds)).archive.map((p) => p.id);
      await archiveStudentsInTx(tx, archivedIds, parentIds);

      const byLevel = new Map<string, string[]>();
      for (const m of plan.moves) byLevel.set(m.to, [...(byLevel.get(m.to) ?? []), m.id]);
      const now = new Date();
      for (const [level, ids] of byLevel) {
        await tx.update(profiles).set({ yearLevel: level, updatedAt: now }).where(inArray(profiles.id, ids));
      }
      moved = plan.moves.length;

      await tx
        .update(schoolYearEnds)
        .set({
          rolledOverAt: now,
          rolledOverBy: checked.user.id,
          moved: plan.moves,
          archivedStudentIds: mergeIds(row.archivedStudentIds, archivedIds),
          archivedParentIds: mergeIds(row.archivedParentIds, parentIds),
        })
        .where(eq(schoolYearEnds.schoolYear, schoolYear));
    });
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.message };
    throw error;
  }

  const banFailed = await namesOf(await banAccounts([...archivedIds, ...parentIds]));
  revalidateSchoolYear();
  return { ok: true, archived: archivedIds.length, parents: parentIds.length, moved, banFailed };
}
