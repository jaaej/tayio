import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/client";

/**
 * Postgres-backed fixed-window rate limiter (migration 0014).
 * Returns true if the caller is still under the limit, false if throttled.
 * Fails OPEN on DB error — a limiter outage must not lock users out.
 */
export async function rateLimit(opts: {
  bucket: string;
  identifier: string;
  max: number;
  windowSeconds: number;
}): Promise<boolean> {
  const { bucket, identifier, max, windowSeconds } = opts;
  if (!identifier) return true; // nothing to key on; don't block
  try {
    const rows = await db.execute<{ allowed: boolean }>(sql`
      select public.check_rate_limit(
        ${bucket}, ${identifier}, ${max}, ${windowSeconds}
      ) as allowed
    `);
    return rows[0]?.allowed ?? true;
  } catch {
    return true;
  }
}

/**
 * Best-effort client IP from proxy headers.
 *
 * TRUST BOUNDARY: x-forwarded-for is only trustworthy behind a proxy that
 * *overwrites* it with the real client IP (Vercel does this). If the origin is
 * reachable directly, a client can spoof this header and rotate "IPs" to evade
 * the per-IP limit. The per-IP limit is therefore a secondary control only —
 * the per-EMAIL / per-USER limits (which don't depend on IP) are the real guard
 * against brute-forcing a specific account. Residual risk: IP-rotated password
 * *spraying* across many accounts. Revisit if the app is ever served without a
 * trusted proxy in front.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}
