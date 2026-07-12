# Admin PIN Wall — Design

**Date:** 2026-07-12
**Status:** Approved design, ready for implementation plan
**Branch:** `feat/student-role-tiers` (continues the role-tiers work; commits `da2bf3a` roles, `30b6a37` reschedule)

Gate the admin portal's most sensitive surfaces behind a **separate admin PIN** (step-up auth). This replaces the earlier "reception vs owner role split + push-approval" idea — that is **dropped**. There is a single admin; the `admin_restricted`/`admin_unrestricted` enum tiers (added in migrations 0017/0018) stay **dormant/unused** for now.

## Scope

**Walled (require PIN unlock):**
1. **Revenue & financial reports** — the dashboard revenue tiles (`revenueMonth`/`revenueLastMonth`, computed in `src/app/admin/_lib/queries.ts`, shown on `src/app/admin/page.tsx`) and the revenue content on `src/app/admin/reports/page.tsx`.
2. **Role / permission changes** — `updateUser` (when it changes `role`) and `createUser` (when the new role is `admin_*` or `tutor`) in `src/app/admin/_lib/actions-users.ts`, plus the role controls in the create/edit user forms.
3. **Account deactivation** — `setUserActive(id, false)` in `actions-users.ts` (there is no hard-delete; deactivation bans the auth user). Reactivation may also be walled for symmetry.

**Explicitly NOT walled:** individual invoice/payment status (daily-ops need it), creating student/parent accounts, password reset, attendance, enrolment, class/schedule management, announcements.

**Out of scope:** reception/owner role split + approval queue (dropped); refunds/discounts (payment model is just free-trial → payment); bulk data export (doesn't exist yet — wall it if/when built).

## Mechanism

**Payment model context:** free trial → payment. No refunds, no discounts.

### A. Storage
New singleton table **`admin_settings`** (migration `0020`):
- `id uuid pk default gen_random_uuid()`
- `pin_hash text` (nullable — null means "no PIN set yet")
- `updated_at timestamptz not null default now()`
- Enforce a single row in app logic (read `limit 1`, upsert the existing row).
- RLS: `enable row level security`, no client policies (all access is server-side Drizzle as postgres, which bypasses RLS) — deny-by-default for anon/authenticated.

Hash the PIN with built-in **`node:crypto` scrypt** (no new dependency): store `"<saltHex>:<hashHex>"`. Verify by re-deriving with the stored salt and `timingSafeEqual`. PIN format: 4–8 digits (validate).

### B. Set / change PIN — `/admin/settings`
New page `src/app/admin/settings/page.tsx` with an "Admin PIN" section:
- If `pin_hash` is null → "Set a PIN" (no current PIN required — bootstrap).
- If set → "Change PIN" requires the current PIN.
- Server action `setAdminPin({ current?: string, next: string })` in a new `src/app/admin/_lib/actions-security.ts`: `requireAdmin()`, verify current when a PIN exists, scrypt-hash `next`, upsert `admin_settings`.

### C. Unlock (step-up)
Server action `unlockAdmin(pin)`:
- `requireAdmin()`, load `pin_hash`; if null → error "No PIN set" (caller routes to settings).
- Verify pin; on success set a **signed, httpOnly cookie** `admin_unlock` = `"<userId>.<expiryMs>.<hmac>"` where `hmac = HMAC_SHA256(key, "<userId>.<expiryMs>")`. Expiry = now + 30 min. Cookie: httpOnly, secure, sameSite=lax, path=/admin.
- Signing `key` = `process.env.ADMIN_PIN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY` (server-only; nothing new required to run, overridable).

Helpers in `src/lib/admin-lock.ts` (server-only):
- `isAdminUnlocked(): Promise<boolean>` — read the cookie, recompute the HMAC, check it matches, not expired, and the `userId` equals the current user's id.
- `assertAdminUnlocked()` — throw if `!isAdminUnlocked()` (used by walled server actions).

One unlock opens **all** walled surfaces for the 30-minute window.

### D. UI
- Reusable client component `src/components/admin/pin-gate.tsx` `<AdminPinGate unlocked={boolean} pinSet={boolean}>{children}</AdminPinGate>`: if `unlocked`, render children; else render a compact PIN prompt (input → `unlockAdmin` → on success `router.refresh()`); if `!pinSet`, render a "Set an admin PIN in Settings" link instead of the input.
- **Revenue:** on the dashboard + reports, wrap the revenue tiles/section in `<AdminPinGate>`; when locked, render a neutral locked placeholder (no figures) with the prompt. Compute revenue in the page regardless (it's server-side and never sent when locked — pass it into the gate only when unlocked, or gate rendering so the number isn't in the DOM while locked).
- **Role controls:** in create/edit user forms, disable the role `<Select>` (and admin/tutor options) while locked, with an inline "Unlock to change roles" + prompt.
- **Deactivation:** gate the deactivate toggle similarly.

### E. Enforcement (defence in depth)
The UI gate is convenience; the **server** is the real boundary:
- `updateUser`: if the submitted role differs from the stored role → `assertAdminUnlocked()` before applying (a plain profile edit with no role change stays open).
- `createUser`: if `role` is `admin_*` or `tutor` → `assertAdminUnlocked()`.
- `setUserActive`: `assertAdminUnlocked()`.
- Revenue is never rendered to a locked admin (page-level check), so the figure isn't exfiltrated via view-source.

## Data flow
1. Admin opens a walled surface → page calls `isAdminUnlocked()`.
2. Locked → `<AdminPinGate>` shows the prompt (or "set a PIN" link).
3. Admin enters PIN → `unlockAdmin` verifies → sets cookie → `router.refresh()`.
4. Now unlocked → content renders; walled actions pass `assertAdminUnlocked()`.
5. After 30 min the cookie expires → re-prompt.

## Error handling
- Wrong PIN → generic "Incorrect PIN" (no lockout for MVP; note as a future hardening).
- No PIN set + walled action attempted → error routes to `/admin/settings`.
- Missing HMAC key (both env vars absent) → `unlockAdmin`/`isAdminUnlocked` throw a clear server error; document that `SUPABASE_SERVICE_ROLE_KEY` is already set in `.env.local`.

## Testing / success criteria
- Migration `0020` applied via `node scripts/apply-sql.mjs supabase/migrations/0020_admin_pin.sql` (additive; safe).
- `npm run typecheck` (tsc) passes.
- No PIN set → dashboard revenue shows a "set a PIN" prompt; setting one in `/admin/settings` works.
- Wrong PIN rejected; correct PIN reveals revenue + enables role/deactivation controls for ~30 min.
- **Server-enforced:** while locked, calling `updateUser` with a role change / `createUser` for an admin / `setUserActive` all fail with an unlock error even if the UI is bypassed.
- Document a dev PIN (e.g. set `1234` via the settings page after applying the migration).

## Deferred / future
- Failed-attempt lockout / rate-limiting on the PIN.
- Bulk-export gating (when built).
- Reception/owner role split (dormant tiers remain available if ever revived).
