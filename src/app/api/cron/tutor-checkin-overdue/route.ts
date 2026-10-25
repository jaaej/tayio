import type { NextRequest } from "next/server";
import { runTutorCheckinOverdueAlerts } from "@/lib/tutor-checkins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Monday 5pm Melbourne: a second admin alert for hours still not approved. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ ok: true, ...(await runTutorCheckinOverdueAlerts()) });
}
