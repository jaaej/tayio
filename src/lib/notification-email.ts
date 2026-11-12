import "server-only";

import { createHash } from "node:crypto";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { emailDeliveries, notifications, profiles } from "@/db/schema";
import { renderNotificationEmail } from "@/lib/notification-email-template";
import { siteOrigin } from "@/lib/site-url";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type NotificationValues = typeof notifications.$inferInsert;

const MAX_ATTEMPTS = 5;
/**
 * A failed copy waits this long before another try. The sweep runs on every
 * admin page view, so without a gap a short Resend outage would use up every
 * attempt within a minute of browsing.
 */
const RETRY_GAP_MS = 15 * 60 * 1000;
const STALE_PROCESSING_MS = 15 * 60 * 1000;
/** Resend's batch endpoint takes up to 100 emails as one request. */
const RESEND_BATCH_SIZE = 100;
/** Resend allows about two requests a second; space batches to stay under it. */
const RESEND_REQUEST_GAP_MS = 600;
/** One run's ceiling; whatever is left goes out on the next run. */
const MAX_PER_RUN = 500;

export type EmailDeliveryResult = {
  configured: boolean;
  attempted: number;
  sent: number;
  failed: number;
};

/**
 * Insert in-portal notifications and queue an email copy of each, inside the
 * caller's transaction, so a notification and its email job exist together
 * or not at all. Returns the new notification ids for an immediate send.
 */
export async function insertNotificationsWithEmail(
  tx: DbTx,
  values: NotificationValues[],
): Promise<string[]> {
  if (values.length === 0) return [];
  const rows = await tx
    .insert(notifications)
    .values(values)
    .returning({ id: notifications.id });
  if (rows.length > 0) {
    await tx
      .insert(emailDeliveries)
      .values(rows.map((row) => ({ notificationId: row.id })));
  }
  return rows.map((row) => row.id);
}

/**
 * Stop the emails of an announcement that is being deleted. Copies already
 * sent stay recorded as sent; only ones not yet delivered are cancelled.
 */
export async function cancelAnnouncementEmails(tx: DbTx, announcementId: string) {
  await tx
    .update(emailDeliveries)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        inArray(emailDeliveries.status, ["pending", "failed"]),
        inArray(
          emailDeliveries.notificationId,
          tx
            .select({ id: notifications.id })
            .from(notifications)
            .where(eq(notifications.dedupeKey, `announcement:${announcementId}`)),
        ),
      ),
    );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send queued notification emails through Resend. Called straight after the
 * action that queued them (for those ids), and by the cron and the admin
 * poller for anything still pending or failed. Jobs stay queued when email is
 * not configured. Each job is claimed before sending and its outcome recorded,
 * so concurrent or repeated runs never send the same copy twice.
 */
export async function deliverPendingEmails({
  notificationIds,
}: {
  notificationIds?: string[];
} = {}): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { configured: false, attempted: 0, sent: 0, failed: 0 };
  }
  if (notificationIds && notificationIds.length === 0) {
    return { configured: true, attempted: 0, sent: 0, failed: 0 };
  }

  const now = new Date();
  await db
    .update(emailDeliveries)
    .set({
      status: "failed",
      lastError: "Delivery claim expired before completion; queued for retry.",
      updatedAt: now,
    })
    .where(
      and(
        eq(emailDeliveries.status, "processing"),
        lt(emailDeliveries.updatedAt, new Date(now.getTime() - STALE_PROCESSING_MS)),
      ),
    );

  const claimable = and(
    or(
      eq(emailDeliveries.status, "pending"),
      and(
        eq(emailDeliveries.status, "failed"),
        lt(emailDeliveries.updatedAt, new Date(now.getTime() - RETRY_GAP_MS)),
      ),
    ),
    lt(emailDeliveries.attempts, MAX_ATTEMPTS),
    notificationIds ? inArray(emailDeliveries.notificationId, notificationIds) : undefined,
  );
  const candidates = await db
    .select({
      notificationId: emailDeliveries.notificationId,
      isActive: profiles.isActive,
    })
    .from(emailDeliveries)
    .innerJoin(notifications, eq(notifications.id, emailDeliveries.notificationId))
    .innerJoin(profiles, eq(profiles.id, notifications.userId))
    .where(claimable)
    .orderBy(emailDeliveries.createdAt)
    .limit(MAX_PER_RUN);

  // A recipient deactivated since the email was queued no longer gets it.
  const inactive = candidates.filter((row) => !row.isActive).map((row) => row.notificationId);
  if (inactive.length > 0) {
    await db
      .update(emailDeliveries)
      .set({ status: "cancelled", lastError: "Recipient deactivated.", updatedAt: now })
      .where(and(claimable, inArray(emailDeliveries.notificationId, inactive)));
  }
  const activeIds = candidates.filter((row) => row.isActive).map((row) => row.notificationId);
  if (activeIds.length === 0) {
    return { configured: true, attempted: 0, sent: 0, failed: 0 };
  }

  // The claim re-checks status under the row lock, so a job another run has
  // already claimed is skipped here rather than sent twice.
  const claimed = await db
    .update(emailDeliveries)
    .set({
      status: "processing",
      attempts: sql`${emailDeliveries.attempts} + 1`,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(and(claimable, inArray(emailDeliveries.notificationId, activeIds)))
    .returning({
      notificationId: emailDeliveries.notificationId,
      attempts: emailDeliveries.attempts,
    });
  if (claimed.length === 0) {
    return { configured: true, attempted: 0, sent: 0, failed: 0 };
  }

  const jobs = await db
    .select({
      notificationId: notifications.id,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      email: profiles.email,
    })
    .from(notifications)
    .innerJoin(profiles, eq(profiles.id, notifications.userId))
    .where(inArray(notifications.id, claimed.map((row) => row.notificationId)))
    .orderBy(notifications.id);

  const attemptOf = new Map(claimed.map((row) => [row.notificationId, row.attempts]));
  const origin = siteOrigin();
  let sent = 0;
  let failed = 0;

  for (let offset = 0; offset < jobs.length; offset += RESEND_BATCH_SIZE) {
    if (offset > 0) await wait(RESEND_REQUEST_GAP_MS);
    const batch = jobs.slice(offset, offset + RESEND_BATCH_SIZE);
    const ids = batch.map((job) => job.notificationId);
    const recordOutcome = (values: Partial<typeof emailDeliveries.$inferInsert>) =>
      db
        .update(emailDeliveries)
        .set({ ...values, updatedAt: new Date() })
        .where(
          and(
            inArray(emailDeliveries.notificationId, ids),
            eq(emailDeliveries.status, "processing"),
          ),
        );

    try {
      const payload = batch.map((job) => {
        const email = renderNotificationEmail({
          title: job.title,
          body: job.body,
          href: job.href,
          origin,
        });
        return {
          from,
          to: [job.email],
          subject: email.subject,
          html: email.html,
          text: email.text,
        };
      });
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // Keyed to these copies and this attempt: a resend of the same
          // request is ignored by Resend, while a later retry is a new request.
          "Idempotency-Key": `notification-emails-${createHash("sha256")
            .update(ids.map((id) => `${id}:${attemptOf.get(id)}`).join(","))
            .digest("hex")}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 1000);
        throw new Error(`Email provider returned ${response.status}: ${detail}`);
      }
      await recordOutcome({ status: "sent", sentAt: new Date(), lastError: null });
      sent += batch.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown email error";
      await recordOutcome({ status: "failed", lastError: message.slice(0, 2000) });
      failed += batch.length;
    }
  }

  return { configured: true, attempted: sent + failed, sent, failed };
}

/**
 * Send right after an action commits, without letting an email outage fail
 * the action: the jobs stay queued for the cron and admin poller to retry.
 */
export async function sendQueuedEmailsNow(notificationIds: string[]) {
  if (notificationIds.length === 0) return null;
  try {
    return await deliverPendingEmails({ notificationIds });
  } catch (error) {
    console.error("[notification-email] immediate send failed; left queued:", error);
    return null;
  }
}
