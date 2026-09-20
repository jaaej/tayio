import "server-only";

import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  announcementEmailDeliveries,
  announcements,
  profiles,
} from "@/db/schema";
import { announcementHrefForRole } from "@/lib/announcement-rules";
import { siteOrigin } from "@/lib/site-url";

const MAX_ATTEMPTS = 3;
const STALE_PROCESSING_MS = 15 * 60 * 1000;

export type AnnouncementEmailDeliveryResult = {
  configured: boolean;
  attempted: number;
  sent: number;
  failed: number;
};

/**
 * Delivers queued urgent-announcement email without weakening the in-portal
 * notification path. Jobs remain pending when email is not configured, and
 * every attempt is recorded so cron retries are safe and auditable.
 */
export async function deliverPendingAnnouncementEmails({
  announcementId,
  limit = 50,
}: {
  announcementId?: string;
  limit?: number;
} = {}): Promise<AnnouncementEmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ANNOUNCEMENT_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { configured: false, attempted: 0, sent: 0, failed: 0 };
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  await db
    .update(announcementEmailDeliveries)
    .set({
      status: "failed",
      lastError: "Delivery claim expired before completion; queued for retry.",
      updatedAt: now,
    })
    .where(
      and(
        eq(announcementEmailDeliveries.status, "processing"),
        lt(announcementEmailDeliveries.updatedAt, staleBefore),
      ),
    );

  const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const filters = [
    inArray(announcementEmailDeliveries.status, ["pending", "failed"]),
    lt(announcementEmailDeliveries.attempts, MAX_ATTEMPTS),
    eq(announcements.status, "published"),
    eq(announcements.isUrgent, true),
  ];
  if (announcementId) {
    filters.push(eq(announcementEmailDeliveries.announcementId, announcementId));
  }

  const jobs = await db
    .select({
      announcementId: announcementEmailDeliveries.announcementId,
      userId: announcementEmailDeliveries.userId,
      attempts: announcementEmailDeliveries.attempts,
      email: profiles.email,
      role: profiles.role,
      title: announcements.title,
      body: announcements.body,
    })
    .from(announcementEmailDeliveries)
    .innerJoin(
      announcements,
      eq(announcements.id, announcementEmailDeliveries.announcementId),
    )
    .innerJoin(profiles, eq(profiles.id, announcementEmailDeliveries.userId))
    .where(and(...filters))
    .limit(boundedLimit);

  let attempted = 0;
  let sent = 0;
  let failed = 0;

  // Small batches avoid flooding the mail provider while keeping the daily
  // cron fast enough for a tuition-centre-sized recipient list.
  for (let offset = 0; offset < jobs.length; offset += 5) {
    const batch = jobs.slice(offset, offset + 5);
    const results = await Promise.all(
      batch.map(async (job) => {
        const [claim] = await db
          .update(announcementEmailDeliveries)
          .set({
            status: "processing",
            attempts: sql`${announcementEmailDeliveries.attempts} + 1`,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(
                announcementEmailDeliveries.announcementId,
                job.announcementId,
              ),
              eq(announcementEmailDeliveries.userId, job.userId),
              or(
                eq(announcementEmailDeliveries.status, "pending"),
                eq(announcementEmailDeliveries.status, "failed"),
              ),
              eq(announcementEmailDeliveries.attempts, job.attempts),
              lt(announcementEmailDeliveries.attempts, MAX_ATTEMPTS),
            ),
          )
          .returning({ userId: announcementEmailDeliveries.userId });

        if (!claim) return "skipped" as const;

        try {
          const href = `${siteOrigin()}${announcementHrefForRole(job.role)}`;
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `announcement-${job.announcementId}-${job.userId}`,
            },
            body: JSON.stringify({
              from,
              to: [job.email],
              subject: `Urgent Taiyo announcement: ${job.title}`,
              text: `${job.body}\n\nOpen Taiyo Portal: ${href}`,
            }),
          });

          if (!response.ok) {
            const responseText = (await response.text()).slice(0, 1000);
            throw new Error(
              `Email provider returned ${response.status}: ${responseText}`,
            );
          }

          const deliveredAt = new Date();
          await db
            .update(announcementEmailDeliveries)
            .set({
              status: "sent",
              sentAt: deliveredAt,
              lastError: null,
              updatedAt: deliveredAt,
            })
            .where(
              and(
                eq(
                  announcementEmailDeliveries.announcementId,
                  job.announcementId,
                ),
                eq(announcementEmailDeliveries.userId, job.userId),
                eq(announcementEmailDeliveries.status, "processing"),
              ),
            );
          return "sent" as const;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown email error";
          await db
            .update(announcementEmailDeliveries)
            .set({
              status: "failed",
              lastError: message.slice(0, 2000),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(
                  announcementEmailDeliveries.announcementId,
                  job.announcementId,
                ),
                eq(announcementEmailDeliveries.userId, job.userId),
                eq(announcementEmailDeliveries.status, "processing"),
              ),
            );
          return "failed" as const;
        }
      }),
    );

    for (const result of results) {
      if (result === "skipped") continue;
      attempted += 1;
      if (result === "sent") sent += 1;
      else failed += 1;
    }
  }

  return { configured: true, attempted, sent, failed };
}
