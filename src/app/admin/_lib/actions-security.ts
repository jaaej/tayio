"use server";

import { z } from "zod";
import { requireAdmin } from "./guard";
import {
  getPinHash,
  upsertPinHash,
  hashPin,
  verifyPin,
  setUnlockCookie,
  isAdminUnlocked,
  getAdminSecurityRow,
  setUnlockState,
} from "@/lib/admin-lock";

const pinSchema = z.string().regex(/^\d{6,8}$/, "PIN must be 6–8 digits");

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Set or change the admin PIN. Bootstrap (no PIN yet) needs no current PIN;
 * once set, the current PIN must be supplied and verified.
 */
export async function setAdminPin(input: { current?: string; next: string }) {
  await requireAdmin();
  const next = pinSchema.safeParse(input.next);
  if (!next.success) return { ok: false as const, error: next.error.issues[0].message };

  const existing = await getPinHash();
  if (existing) {
    if (!input.current || !verifyPin(input.current, existing)) {
      return { ok: false as const, error: "Current PIN is incorrect" };
    }
  }
  await upsertPinHash(hashPin(next.data));
  return { ok: true as const };
}

/** Verify the PIN and, on success, set the 30-minute unlock cookie.
 * Enforces a failed-attempt lockout to resist brute force. */
export async function unlockAdmin(pin: string) {
  const user = await requireAdmin();
  // Reject malformed input up front so it can't burn the lockout budget.
  if (!pinSchema.safeParse(pin).success) {
    return { ok: false as const, error: "Incorrect PIN" };
  }
  const row = await getAdminSecurityRow();
  if (!row || !row.pinHash) return { ok: false as const, error: "No PIN set" };

  const now = Date.now();
  if (row.lockedUntil && row.lockedUntil.getTime() > now) {
    const mins = Math.ceil((row.lockedUntil.getTime() - now) / 60000);
    return {
      ok: false as const,
      error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
    };
  }

  if (!verifyPin(pin, row.pinHash)) {
    const attempts = row.failedAttempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      // Lock out and reset the counter so a fresh window starts after expiry.
      await setUnlockState(row.id, 0, new Date(now + LOCKOUT_MS));
      return {
        ok: false as const,
        error: "Too many attempts. Locked for 15 minutes.",
      };
    }
    await setUnlockState(row.id, attempts, null);
    return { ok: false as const, error: "Incorrect PIN" };
  }

  // Correct PIN: clear lockout bookkeeping and open the window.
  await setUnlockState(row.id, 0, null);
  await setUnlockCookie(user.id);
  return { ok: true as const };
}

/** Read-only state for rendering the gate UI. */
export async function getAdminSecurityState() {
  await requireAdmin();
  const [hash, unlocked] = await Promise.all([getPinHash(), isAdminUnlocked()]);
  return { pinSet: !!hash, unlocked };
}
