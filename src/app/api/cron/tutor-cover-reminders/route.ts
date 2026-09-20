import type { NextRequest } from "next/server";
import { runTutorCoverReminders } from "@/lib/tutor-cover";
import { runFreeTrialNotifications } from "@/lib/free-trial-notifications";
import { deliverPendingAnnouncementEmails } from "@/lib/announcement-email";
import { runTutorCheckinReminders } from "@/lib/tutor-checkins";
import { ensureRecurringLessons } from "@/lib/recurring-lessons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [cover, freeTrials, checkins, announcementEmails, recurringLessons] = await Promise.all([
    runTutorCoverReminders(),
    runFreeTrialNotifications(),
    runTutorCheckinReminders(),
    deliverPendingAnnouncementEmails({ limit: 100 }),
    ensureRecurringLessons(),
  ]);
  return Response.json({
    ok: true,
    cover,
    freeTrials,
    checkins,
    announcementEmails,
    recurringLessons,
  });
}
