"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  notifications,
  tutorBankDetails,
  tutorCheckinEntries,
  tutorWeeklyCheckins,
} from "@/db/schema";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { withActor } from "@/lib/with-actor";

const schema = z.object({
  tutorId: z.string().uuid(),
  accountName: z.string().max(120).optional(),
  bsb: z.string().max(20).optional(),
  accountNumber: z.string().max(40).optional(),
  hourlyRate: z.number().min(0).max(10000).optional().nullable(),
  note: z.string().max(500).optional(),
});

function clean(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

/**
 * Upsert a tutor's payroll bank details. Owner-only (PII) - reception is
 * bounced by requireUnrestrictedAdmin. Audited via withActor. Empty fields are
 * stored as NULL so clearing a field works.
 */
export async function setTutorBankDetails(input: z.infer<typeof schema>) {
  const user = await requireUnrestrictedAdmin();
  const data = schema.parse(input);

  const values = {
    tutorId: data.tutorId,
    accountName: clean(data.accountName),
    bsb: clean(data.bsb),
    accountNumber: clean(data.accountNumber),
    hourlyRate:
      data.hourlyRate == null ? null : data.hourlyRate.toFixed(2),
    note: clean(data.note),
    updatedById: user.id,
    updatedAt: new Date(),
  };

  const result = await withActor({ id: user.id, role: "admin" }, async (tx) => {
    await tx
      .insert(tutorBankDetails)
      .values(values)
      .onConflictDoUpdate({
        target: tutorBankDetails.tutorId,
        set: {
          accountName: values.accountName,
          bsb: values.bsb,
          accountNumber: values.accountNumber,
          hourlyRate: values.hourlyRate,
          note: values.note,
          updatedById: values.updatedById,
          updatedAt: sql`now()`,
        },
      });

    const changedAt = new Date();
    const rate = values.hourlyRate ?? "0.00";
    const openCheckins = await tx
      .select({ id: tutorWeeklyCheckins.id })
      .from(tutorWeeklyCheckins)
      .where(
        and(
          eq(tutorWeeklyCheckins.tutorId, data.tutorId),
          inArray(tutorWeeklyCheckins.status, ["pending", "disputed"]),
        ),
      )
      .for("update");
    const openIds = openCheckins.map((row) => row.id);
    let openEntriesUpdated = 0;
    if (openIds.length > 0) {
      const updated = await tx
        .update(tutorCheckinEntries)
        .set({
          hourlyRate: rate,
          updatedById: user.id,
          updatedAt: changedAt,
        })
        .where(
          and(
            inArray(tutorCheckinEntries.checkinId, openIds),
            eq(tutorCheckinEntries.isManualOverride, false),
            ne(tutorCheckinEntries.hourlyRate, rate),
          ),
        )
        .returning({ id: tutorCheckinEntries.id });
      openEntriesUpdated = updated.length;
      if (openEntriesUpdated > 0) {
        await tx
          .update(tutorWeeklyCheckins)
          .set({ updatedAt: changedAt })
          .where(inArray(tutorWeeklyCheckins.id, openIds));
      }
    }

    // A legacy approved $0 row is unsafe: it would silently underpay the
    // tutor. Once a valid rate exists, repair generated rows and send the week
    // back to the tutor for explicit re-approval. Valid approved snapshots stay
    // frozen so a later rate rise never rewrites historical payroll.
    let reopenedWeeks = 0;
    if (Number(rate) > 0) {
      // Lock approved snapshots before checking them so a concurrent payroll
      // correction cannot produce a half-old/half-new result.
      await tx
        .select({ id: tutorWeeklyCheckins.id })
        .from(tutorWeeklyCheckins)
        .where(
          and(
            eq(tutorWeeklyCheckins.tutorId, data.tutorId),
            eq(tutorWeeklyCheckins.status, "approved"),
          ),
        )
        .for("update");
      const unsafeApproved = await tx
        .selectDistinct({
          id: tutorWeeklyCheckins.id,
          weekStart: tutorWeeklyCheckins.weekStart,
        })
        .from(tutorWeeklyCheckins)
        .innerJoin(
          tutorCheckinEntries,
          eq(tutorCheckinEntries.checkinId, tutorWeeklyCheckins.id),
        )
        .where(
          and(
            eq(tutorWeeklyCheckins.tutorId, data.tutorId),
            eq(tutorWeeklyCheckins.status, "approved"),
            eq(tutorCheckinEntries.isRemoved, false),
            lte(tutorCheckinEntries.hourlyRate, "0"),
          ),
        );
      const unsafeIds = unsafeApproved.map((row) => row.id);
      if (unsafeIds.length > 0) {
        await tx
          .update(tutorWeeklyCheckins)
          .set({
            status: "pending",
            approvedAt: null,
            disputeMessage: null,
            updatedAt: changedAt,
          })
          .where(inArray(tutorWeeklyCheckins.id, unsafeIds));
        await tx
          .update(tutorCheckinEntries)
          .set({
            hourlyRate: rate,
            updatedById: user.id,
            updatedAt: changedAt,
          })
          .where(
            and(
              inArray(tutorCheckinEntries.checkinId, unsafeIds),
              eq(tutorCheckinEntries.isManualOverride, false),
              lte(tutorCheckinEntries.hourlyRate, "0"),
            ),
          );
        await tx
          .insert(notifications)
          .values(
            unsafeApproved.map((week) => ({
              userId: data.tutorId,
              channel: "in_app" as const,
              title: "Review your corrected hourly rate",
              body: `Admin added your hourly rate for the week starting ${week.weekStart}. Review the pay total and approve the week again.`,
              href: `/tutor/checkin?week=${week.weekStart}`,
              dedupeKey: `tutor-checkin-rate-reapproval:${week.id}:${rate}`,
            })),
          )
          .onConflictDoNothing();
        reopenedWeeks = unsafeIds.length;
      }
    }

    return { openEntriesUpdated, reopenedWeeks };
  });

  revalidatePath("/admin/tutors");
  revalidatePath("/admin/tutor-checkins");
  revalidatePath(`/admin/users/${data.tutorId}`);
  revalidatePath("/tutor/checkin");
  revalidatePath("/tutor/notifications");
  return { ok: true as const, ...result };
}
