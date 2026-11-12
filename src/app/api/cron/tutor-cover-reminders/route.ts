import type { NextRequest } from "next/server";
import { runTutorCoverReminders } from "@/lib/tutor-cover";
import { runFreeTrialSweep } from "@/lib/free-trial-notifications";
import { runTutorCheckinReminders } from "@/lib/tutor-checkins";
import { ensureRecurringLessons } from "@/lib/recurring-lessons";
import { runEnrolmentEndSweep } from "@/lib/enrolment-ends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // The cover sweep also sends every notification email still queued
  // (announcements included), so it doubles as the email retry.
  const [cover, freeTrials, checkins, recurringLessons, enrolmentEnds] = await Promise.all([
    runTutorCoverReminders(),
    runFreeTrialSweep(),
    runTutorCheckinReminders(),
    ensureRecurringLessons(),
    runEnrolmentEndSweep(),
  ]);
  return Response.json({
    ok: true,
    cover,
    freeTrials,
    checkins,
    recurringLessons,
    enrolmentEnds,
  });
}
