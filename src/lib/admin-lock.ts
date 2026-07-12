import "server-only";
import {
  randomBytes,
  scryptSync,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { adminSettings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const COOKIE = "admin_unlock";
const WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const KEYLEN = 64;

function signingKey(): string {
  const key =
    process.env.ADMIN_PIN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Admin PIN signing key missing: set ADMIN_PIN_SECRET or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return key;
}

/** "<saltHex>:<hashHex>" — scrypt over the PIN with a random 16-byte salt. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEYLEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Constant-time verify against a stored "<saltHex>:<hashHex>". */
export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pin, Buffer.from(saltHex, "hex"), KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Read the singleton settings row's PIN hash (null = no PIN set yet). */
export async function getPinHash(): Promise<string | null> {
  const [row] = await db
    .select({ id: adminSettings.id, pinHash: adminSettings.pinHash })
    .from(adminSettings)
    .limit(1);
  return row?.pinHash ?? null;
}

/** Set the PIN hash, enforcing a single row (insert if the table is empty). */
export async function upsertPinHash(hash: string): Promise<void> {
  const [row] = await db
    .select({ id: adminSettings.id })
    .from(adminSettings)
    .limit(1);
  if (row) {
    await db
      .update(adminSettings)
      .set({ pinHash: hash, updatedAt: new Date() })
      .where(eq(adminSettings.id, row.id));
  } else {
    await db.insert(adminSettings).values({ pinHash: hash });
  }
}

/** Full singleton security row (or null if no row yet). */
export async function getAdminSecurityRow(): Promise<{
  id: string;
  pinHash: string | null;
  failedAttempts: number;
  lockedUntil: Date | null;
} | null> {
  const [row] = await db
    .select({
      id: adminSettings.id,
      pinHash: adminSettings.pinHash,
      failedAttempts: adminSettings.failedAttempts,
      lockedUntil: adminSettings.lockedUntil,
    })
    .from(adminSettings)
    .limit(1);
  return row ?? null;
}

/** Overwrite the lockout bookkeeping on the singleton row. */
export async function setUnlockState(
  id: string,
  failedAttempts: number,
  lockedUntil: Date | null,
): Promise<void> {
  await db
    .update(adminSettings)
    .set({ failedAttempts, lockedUntil, updatedAt: new Date() })
    .where(eq(adminSettings.id, id));
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("hex");
}

/** Write the signed unlock cookie bound to `userId`, valid for 30 min. */
export async function setUnlockCookie(userId: string): Promise<void> {
  const expiry = Date.now() + WINDOW_MS;
  const payload = `${userId}.${expiry}`;
  const value = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: WINDOW_MS / 1000,
  });
}

/**
 * True iff the cookie is present, its HMAC verifies, it hasn't expired, and it
 * belongs to the currently signed-in user. Any tampering → false.
 */
export async function isAdminUnlocked(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;

  const lastDot = raw.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = raw.slice(0, lastDot);
  const mac = raw.slice(lastDot + 1);

  let expectedMac: string;
  try {
    expectedMac = sign(payload);
  } catch {
    // Signing key missing/misconfigured — treat as not-unlocked rather than
    // throwing, so a stale cookie can't 500 a page render.
    return false;
  }
  const macBuf = Buffer.from(mac, "hex");
  const expBuf = Buffer.from(expectedMac, "hex");
  if (macBuf.length !== expBuf.length || !timingSafeEqual(macBuf, expBuf)) {
    return false;
  }

  // userId is a Supabase UUID (contains no dots), so this split is unambiguous.
  const [userId, expiryStr] = payload.split(".");
  const expiry = Number(expiryStr);
  if (!userId || !Number.isFinite(expiry) || Date.now() > expiry) return false;

  const user = await getCurrentUser();
  return !!user && user.id === userId;
}
