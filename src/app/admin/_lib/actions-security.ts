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
} from "@/lib/admin-lock";

const pinSchema = z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits");

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

/** Verify the PIN and, on success, set the 30-minute unlock cookie. */
export async function unlockAdmin(pin: string) {
  const user = await requireAdmin();
  const hash = await getPinHash();
  if (!hash) return { ok: false as const, error: "No PIN set" };
  if (!verifyPin(pin, hash)) return { ok: false as const, error: "Incorrect PIN" };
  await setUnlockCookie(user.id);
  return { ok: true as const };
}

/** Read-only state for rendering the gate UI. */
export async function getAdminSecurityState() {
  await requireAdmin();
  const [hash, unlocked] = await Promise.all([getPinHash(), isAdminUnlocked()]);
  return { pinSet: !!hash, unlocked };
}
