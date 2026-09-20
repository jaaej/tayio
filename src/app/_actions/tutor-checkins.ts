"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  notifications,
  profiles,
  tutorCheckinEntries,
  tutorWeeklyCheckins,
} from "@/db/schema";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import {
  addIsoDays,
  checkinApprovalTimingError,
  checkinMinutes,
  weekStartForIsoDate,
} from "@/lib/tutor-checkin-rules";
import { getTutorCheckinWeek } from "@/lib/tutor-checkins";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { withActor } from "@/lib/with-actor";
import { requireTutor } from "@/app/tutor/_data";

const weekSchema = z.object({ weekStart: z.string().date() });
const disputeSchema = weekSchema.extend({
  message: z.string().trim().min(5).max(2000),
});

type ActorTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function approveTutorCheckin(input: { weekStart: string }) {
  const tutor = await requireTutor();
  const data = weekSchema.safeParse(input);
  if (!data.success) return { ok: false as const, error: "Choose a valid week." };
  const view = await getTutorCheckinWeek(tutor.id, data.data.weekStart);
  if (view.status === "approved") return { ok: true as const };
  if (view.weekStart > weekStartForIsoDate(melbourneDate())) {
    return { ok: false as const, error: "A future week cannot be approved." };
  }
  if (view.entries.every((entry) => entry.isRemoved)) {
    return { ok: false as const, error: "There are no worked lessons to approve." };
  }
  if (view.hasMissingRate) {
    return {
      ok: false as const,
      error: "Admin must set a valid hourly rate before this week can be approved.",
    };
  }
  const timingError = checkinApprovalTimingError(view.entries);
  if (timingError) return { ok: false as const, error: timingError };

  const approved = await withActor(
    { id: tutor.id, role: "tutor" },
    async (tx) => {
      const [current] = await tx
        .select({ updatedAt: tutorWeeklyCheckins.updatedAt })
        .from(tutorWeeklyCheckins)
        .where(
          and(
            eq(tutorWeeklyCheckins.id, view.id),
            eq(tutorWeeklyCheckins.tutorId, tutor.id),
          ),
        )
        .for("update")
        .limit(1);
      if (!current || current.updatedAt.getTime() !== view.updatedAt.getTime()) {
        return false;
      }
      const changed = await tx
      .update(tutorWeeklyCheckins)
      .set({
        status: "approved",
        approvedAt: new Date(),
        disputeMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tutorWeeklyCheckins.id, view.id),
          eq(tutorWeeklyCheckins.tutorId, tutor.id),
        ),
      )
      .returning({ id: tutorWeeklyCheckins.id });
      return changed.length === 1;
    },
  );
  if (!approved) {
    return {
      ok: false as const,
      error: "These hours changed while you were reviewing them. Refresh and check them again.",
    };
  }
  revalidateCheckinPaths();
  return { ok: true as const };
}

export async function disputeTutorCheckin(input: {
  weekStart: string;
  message: string;
}) {
  const tutor = await requireTutor();
  const data = disputeSchema.safeParse(input);
  if (!data.success) {
    return {
      ok: false as const,
      error: data.error.issues[0]?.message ?? "Explain what is incorrect.",
    };
  }
  const view = await getTutorCheckinWeek(tutor.id, data.data.weekStart);
  const owners = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        inArray(profiles.role, ["admin", "admin_unrestricted"]),
        eq(profiles.isActive, true),
      ),
    );

  const saved = await withActor({ id: tutor.id, role: "tutor" }, async (tx) => {
    const [current] = await tx
      .select({
        status: tutorWeeklyCheckins.status,
        updatedAt: tutorWeeklyCheckins.updatedAt,
      })
      .from(tutorWeeklyCheckins)
      .where(
        and(
          eq(tutorWeeklyCheckins.id, view.id),
          eq(tutorWeeklyCheckins.tutorId, tutor.id),
        ),
      )
      .for("update")
      .limit(1);
    if (!current || current.updatedAt.getTime() !== view.updatedAt.getTime()) {
      return false;
    }
    const wasAlreadyDisputed = current.status === "disputed";
    await tx
      .update(tutorWeeklyCheckins)
      .set({
        status: "disputed",
        approvedAt: null,
        disputeMessage: data.data.message,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tutorWeeklyCheckins.id, view.id),
          eq(tutorWeeklyCheckins.tutorId, tutor.id),
        ),
      );
    if (!wasAlreadyDisputed && owners.length > 0) {
      await tx.insert(notifications).values(
        owners.map((owner) => ({
          userId: owner.id,
          channel: "in_app" as const,
          title: "Tutor reported incorrect hours",
          body: `${tutor.email || "A tutor"}: ${data.data.message}`,
          href: `/admin/tutor-checkins?week=${view.weekStart}&tutor=${tutor.id}`,
          dedupeKey: `tutor-checkin-dispute:${view.id}:${view.updatedAt.getTime()}`,
        })),
      ).onConflictDoNothing();
    }
    return true;
  });
  if (!saved) {
    return {
      ok: false as const,
      error: "These hours changed while you were reporting the issue. Refresh and try again.",
    };
  }
  revalidateCheckinPaths();
  return { ok: true as const };
}

const correctionSchema = z.object({
  entryId: z.string().uuid(),
  subjectName: z.string().trim().min(1).max(160),
  className: z.string().trim().min(1).max(160),
  workDate: z.string().date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  hourlyRate: z.coerce.number().min(0).max(10000),
  note: z.string().trim().max(1000).optional(),
  expectedUpdatedAt: z.string().datetime(),
});

export async function adminCorrectTutorCheckin(input: {
  entryId: string;
  subjectName: string;
  className: string;
  workDate: string;
  startTime: string;
  endTime: string;
  hourlyRate: string | number;
  note?: string;
  expectedUpdatedAt: string;
}) {
  const admin = await requireUnrestrictedAdmin();
  const data = correctionSchema.safeParse(input);
  if (!data.success) {
    return {
      ok: false as const,
      error: data.error.issues[0]?.message ?? "Check the correction details.",
    };
  }
  let minutes: number;
  try {
    minutes = checkinMinutes(data.data.startTime, data.data.endTime);
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }
  const changedAt = new Date();
  const result = await withActor({ id: admin.id, role: "admin" }, async (tx) => {
    let context = await getEntryContext(tx, data.data.entryId);
    if (!context) return "missing" as const;
    await tx.execute(
      sql`select id from ${tutorWeeklyCheckins} where id = ${context.checkinId} for update`,
    );
    await tx.execute(
      sql`select id from ${tutorCheckinEntries} where id = ${data.data.entryId} for update`,
    );
    context = await getEntryContext(tx, data.data.entryId);
    if (!context) return "missing" as const;
    if (context.entryUpdatedAt.getTime() !== new Date(data.data.expectedUpdatedAt).getTime()) {
      return "stale" as const;
    }
    if (
      data.data.workDate < context.weekStart ||
      data.data.workDate > addIsoDays(context.weekStart, 6)
    ) {
      return "outside-week" as const;
    }
    await resetCheckinForReapproval(tx, context.checkinId, changedAt);
    await tx
      .update(tutorCheckinEntries)
      .set({
        subjectName: data.data.subjectName,
        className: data.data.className,
        workDate: data.data.workDate,
        startTime: `${data.data.startTime}:00`,
        endTime: `${data.data.endTime}:00`,
        minutes,
        hourlyRate: data.data.hourlyRate.toFixed(2),
        note: data.data.note || null,
        isManualOverride: true,
        isRemoved: false,
        updatedById: admin.id,
        updatedAt: changedAt,
      })
      .where(eq(tutorCheckinEntries.id, data.data.entryId));
    await notifyTutorOfCorrection(tx, context, data.data.entryId, changedAt);
    return "ok" as const;
  });
  if (result === "missing") {
    return { ok: false as const, error: "Check-in row not found." };
  }
  if (result === "stale") {
    return {
      ok: false as const,
      error: "This row was changed elsewhere. Refresh before editing it again.",
    };
  }
  if (result === "outside-week") {
    return {
      ok: false as const,
      error: "The work date must stay within this Monday–Sunday week.",
    };
  }
  revalidateCheckinPaths();
  return { ok: true as const };
}

export async function adminSetTutorCheckinEntryRemoved(input: {
  entryId: string;
  removed: boolean;
  expectedUpdatedAt: string;
}) {
  const admin = await requireUnrestrictedAdmin();
  const parsed = z
    .object({
      entryId: z.string().uuid(),
      removed: z.boolean(),
      expectedUpdatedAt: z.string().datetime(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid check-in row." };
  const changedAt = new Date();
  const result = await withActor({ id: admin.id, role: "admin" }, async (tx) => {
    let context = await getEntryContext(tx, parsed.data.entryId);
    if (!context) return "missing" as const;
    await tx.execute(
      sql`select id from ${tutorWeeklyCheckins} where id = ${context.checkinId} for update`,
    );
    await tx.execute(
      sql`select id from ${tutorCheckinEntries} where id = ${parsed.data.entryId} for update`,
    );
    context = await getEntryContext(tx, parsed.data.entryId);
    if (!context) return "missing" as const;
    if (context.entryUpdatedAt.getTime() !== new Date(parsed.data.expectedUpdatedAt).getTime()) {
      return "stale" as const;
    }
    await resetCheckinForReapproval(tx, context.checkinId, changedAt);
    await tx
      .update(tutorCheckinEntries)
      .set({
        isRemoved: parsed.data.removed,
        isManualOverride: true,
        updatedById: admin.id,
        updatedAt: changedAt,
      })
      .where(eq(tutorCheckinEntries.id, parsed.data.entryId));
    await notifyTutorOfCorrection(tx, context, parsed.data.entryId, changedAt);
    return "ok" as const;
  });
  if (result === "missing") {
    return { ok: false as const, error: "Check-in row not found." };
  }
  if (result === "stale") {
    return {
      ok: false as const,
      error: "This row was changed elsewhere. Refresh before editing it again.",
    };
  }
  revalidateCheckinPaths();
  return { ok: true as const };
}

async function getEntryContext(tx: ActorTransaction, entryId: string) {
  const [row] = await tx
    .select({
      checkinId: tutorWeeklyCheckins.id,
      tutorId: tutorWeeklyCheckins.tutorId,
      weekStart: tutorWeeklyCheckins.weekStart,
      entryUpdatedAt: tutorCheckinEntries.updatedAt,
    })
    .from(tutorCheckinEntries)
    .innerJoin(
      tutorWeeklyCheckins,
      eq(tutorWeeklyCheckins.id, tutorCheckinEntries.checkinId),
    )
    .where(eq(tutorCheckinEntries.id, entryId))
    .limit(1);
  return row;
}

async function resetCheckinForReapproval(
  tx: ActorTransaction,
  checkinId: string,
  changedAt: Date,
) {
  await tx
    .update(tutorWeeklyCheckins)
    .set({
      status: "pending",
      approvedAt: null,
      disputeMessage: null,
      updatedAt: changedAt,
    })
    .where(eq(tutorWeeklyCheckins.id, checkinId));
}

async function notifyTutorOfCorrection(
  tx: ActorTransaction,
  context: NonNullable<Awaited<ReturnType<typeof getEntryContext>>>,
  entryId: string,
  changedAt: Date,
) {
  await tx.insert(notifications).values({
    userId: context.tutorId,
    channel: "in_app",
    title: "Your weekly hours were corrected",
    body: "Admin updated this check-in. Review the corrected hours and approve the week again.",
    href: `/tutor/checkin?week=${context.weekStart}`,
    dedupeKey: `tutor-checkin-correction:${context.checkinId}:${entryId}:${changedAt.getTime()}`,
  }).onConflictDoNothing();
}

function revalidateCheckinPaths() {
  revalidatePath("/tutor/checkin");
  revalidatePath("/admin/tutor-checkins");
  revalidatePath("/admin/notifications");
}
