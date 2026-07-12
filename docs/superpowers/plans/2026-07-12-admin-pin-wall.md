# Admin PIN Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the admin portal's sensitive *mutations* — role/permission changes and account deactivation — behind a separate admin PIN (step-up auth), enforced on the server with a UI convenience gate on top.

**Architecture:** A singleton `admin_settings` table stores a scrypt-hashed PIN. Unlocking sets a signed, httpOnly cookie (`admin_unlock`, HMAC-signed, 30-min expiry, bound to the user id). Server actions call `assertAdminUnlocked()` before applying a walled change; pages/forms call `isAdminUnlocked()` to render a PIN prompt instead of the live control. One unlock opens all walled surfaces for the window.

**Tech Stack:** Next.js 16 App Router (server actions, `next/headers` cookies), Drizzle ORM over Postgres, `node:crypto` (scrypt + HMAC, no new dependency), Zod, Tailwind v4.

## Global Constraints

- **Scope this build (revenue deferred by decision 2026-07-12):** wall only (a) role changes in `createUser`/`updateUser` and (b) `setUserActive` (deactivate + reactivate). Revenue is NOT surfaced anywhere today, so it is untouched; the helpers/component built here let it be walled in one step when a revenue tile is later built.
- **No new npm dependency.** Hash with `node:crypto` scrypt; sign the cookie with `node:crypto` HMAC-SHA256.
- **PIN format:** 4–8 digits (`/^\d{4,8}$/`).
- **HMAC / signing key:** `process.env.ADMIN_PIN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY` (already set in `.env.local`). If both absent, throw a clear server error.
- **Unlock cookie:** name `admin_unlock`, value `"<userId>.<expiryMs>.<hmacHex>"`, `httpOnly: true, secure: true, sameSite: "lax", path: "/admin"`, expiry = now + 30 min.
- **Server is the boundary.** The UI gate is convenience only; every walled server action re-checks with `assertAdminUnlocked()` (defence in depth, same pattern as `requireAdmin()`).
- **Migrations are additive raw SQL**, applied via `node scripts/apply-sql.mjs supabase/migrations/<file>` (uses `DIRECT_URL`, session pooler). NEVER `db:push`/`db:generate` (wipes RLS). New table gets RLS enabled with no client policies (server-side Drizzle bypasses RLS).
- **Verification for this repo = `npm run typecheck` (tsc --noEmit) + runtime checks under the admin role.** There is no unit-test runner; pure-crypto helpers are proven with a one-off `node` round-trip script (deleted after).
- **Match house style:** server actions start with `requireAdmin()`; Drizzle tables use `uuid("id").primaryKey().defaultRandom()` and `timestamp(..., { withTimezone: true }).defaultNow()`; admin UI uses `@/components/admin/ui` primitives.

---

### Task 1: `admin_settings` table (migration 0020 + schema)

**Files:**
- Create: `supabase/migrations/0020_admin_pin.sql`
- Modify: `src/db/schema.ts` (append a new table near the other `pgTable` definitions)

**Interfaces:**
- Produces: Drizzle table `adminSettings` with columns `id: string`, `pinHash: string | null`, `updatedAt: Date`. Used by Tasks 2–3.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0020_admin_pin.sql`:

```sql
-- Admin PIN wall (step-up auth). Singleton settings table holding a scrypt
-- hash of the admin PIN. Enforced as a single row in app logic (read limit 1,
-- upsert the existing row). RLS on, no client policies: all access is
-- server-side Drizzle as postgres, which bypasses RLS. Deny-by-default for
-- anon/authenticated. Additive + safe.
create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  pin_hash text,
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;
```

- [ ] **Step 2: Apply the migration**

Run: `node scripts/apply-sql.mjs supabase/migrations/0020_admin_pin.sql`
Expected: `✓ applied supabase/migrations/0020_admin_pin.sql`

- [ ] **Step 3: Verify the table exists and is empty**

Run:
```bash
node -e "import('postgres').then(async ({default:p})=>{const d=require('dotenv');d.config({path:'.env.local'});const sql=p(process.env.DIRECT_URL,{prepare:false,max:1});console.log(await sql\`select count(*)::int as n from admin_settings\`);await sql.end();})"
```
Expected: `[ { n: 0 } ]` (table exists, no rows yet).

- [ ] **Step 4: Add the Drizzle table to schema.ts**

In `src/db/schema.ts`, after the `profiles`/`familyLinks` block (anywhere among the `pgTable` definitions is fine; keep it near the top-level admin tables), add:

```ts
export const adminSettings = pgTable("admin_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  pinHash: text("pin_hash"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). The new export is unused so far — that's fine.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0020_admin_pin.sql src/db/schema.ts
git commit -m "feat(admin-pin): add admin_settings table (migration 0020)"
```

---

### Task 2: Lock + crypto helpers (`src/lib/admin-lock.ts`)

**Files:**
- Create: `src/lib/admin-lock.ts`

**Interfaces:**
- Consumes: `adminSettings` (Task 1), `db` from `@/db/client`, `getCurrentUser` from `@/lib/auth`, `cookies` from `next/headers`.
- Produces (all server-only):
  - `hashPin(pin: string): string` — returns `"<saltHex>:<hashHex>"`.
  - `verifyPin(pin: string, stored: string): boolean` — constant-time compare.
  - `getPinHash(): Promise<string | null>` — reads the singleton row's `pin_hash`.
  - `upsertPinHash(hash: string): Promise<void>` — sets the singleton row (insert if none).
  - `setUnlockCookie(userId: string): Promise<void>` — writes the signed `admin_unlock` cookie (30 min).
  - `isAdminUnlocked(): Promise<boolean>` — validates the cookie against the current user.
  - `assertAdminUnlocked(): Promise<void>` — throws `Error("Admin unlock required")` if not unlocked.

- [ ] **Step 1: Write the helper module**

Create `src/lib/admin-lock.ts`:

```ts
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

  const expectedMac = sign(payload);
  const macBuf = Buffer.from(mac, "hex");
  const expBuf = Buffer.from(expectedMac, "hex");
  if (macBuf.length !== expBuf.length || !timingSafeEqual(macBuf, expBuf)) {
    return false;
  }

  const [userId, expiryStr] = payload.split(".");
  const expiry = Number(expiryStr);
  if (!userId || !Number.isFinite(expiry) || Date.now() > expiry) return false;

  const user = await getCurrentUser();
  return !!user && user.id === userId;
}

/** Throw unless the admin has unlocked. Walled server actions call this. */
export async function assertAdminUnlocked(): Promise<void> {
  if (!(await isAdminUnlocked())) {
    throw new Error("Admin unlock required");
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Prove the crypto round-trips with a throwaway node script**

Create `scratch-pin-test.mjs` at the repo root:

```js
import { randomBytes, scryptSync, createHmac, timingSafeEqual } from "node:crypto";
const KEYLEN = 64;
const hashPin = (pin) => { const s = randomBytes(16); return `${s.toString("hex")}:${scryptSync(pin, s, KEYLEN).toString("hex")}`; };
const verifyPin = (pin, stored) => { const [sh, hh] = stored.split(":"); const e = Buffer.from(hh, "hex"); const a = scryptSync(pin, Buffer.from(sh, "hex"), KEYLEN); return e.length === a.length && timingSafeEqual(e, a); };
const h = hashPin("1234");
console.log("correct pin verifies:", verifyPin("1234", h) === true);
console.log("wrong pin rejected:  ", verifyPin("9999", h) === false);
const key = "test-secret";
const sign = (p) => createHmac("sha256", key).update(p).digest("hex");
const payload = "user-abc.1712345678000";
const good = `${payload}.${sign(payload)}`;
const tampered = `user-xyz.1712345678000.${sign(payload)}`;
const check = (raw) => { const i = raw.lastIndexOf("."); const p = raw.slice(0, i); const m = raw.slice(i + 1); const mb = Buffer.from(m, "hex"); const eb = Buffer.from(sign(p), "hex"); return mb.length === eb.length && timingSafeEqual(mb, eb); };
console.log("valid cookie mac:    ", check(good) === true);
console.log("tampered cookie mac: ", check(tampered) === false);
```

Run: `node scratch-pin-test.mjs`
Expected: four lines, all ending `true`.

- [ ] **Step 4: Delete the throwaway script**

Run: `rm scratch-pin-test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-lock.ts
git commit -m "feat(admin-pin): scrypt PIN hashing + signed unlock cookie helpers"
```

---

### Task 3: Security server actions (`src/app/admin/_lib/actions-security.ts`)

**Files:**
- Create: `src/app/admin/_lib/actions-security.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`./guard`), everything from `@/lib/admin-lock` (Task 2).
- Produces:
  - `setAdminPin(input: { current?: string; next: string }): Promise<{ ok: true } | { ok: false; error: string }>`
  - `unlockAdmin(pin: string): Promise<{ ok: true } | { ok: false; error: string }>`
  - `getAdminSecurityState(): Promise<{ pinSet: boolean; unlocked: boolean }>` — a server helper (not a mutation) pages call to drive the gate UI.

- [ ] **Step 1: Write the actions module**

Create `src/app/admin/_lib/actions-security.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_lib/actions-security.ts
git commit -m "feat(admin-pin): setAdminPin / unlockAdmin / security-state actions"
```

---

### Task 4: PIN gate component, settings page, nav link

**Files:**
- Create: `src/components/admin/pin-gate.tsx` (client)
- Create: `src/app/admin/settings/page.tsx` (server)
- Create: `src/app/admin/settings/_components/pin-settings-form.tsx` (client)
- Modify: `src/components/admin/shell.tsx` (add a "Settings" nav item under the "Insight" section)

**Interfaces:**
- Consumes: `unlockAdmin`, `setAdminPin`, `getAdminSecurityState` (Task 3); `@/components/admin/ui` (`Card`, `CardHead`, `Button`, `PageHeader`, `Pill`); `@/components/ui/input` (`Input`, `Label`).
- Produces:
  - `AdminPinPrompt` (client): a compact PIN input that calls `unlockAdmin` and `router.refresh()` on success. Props: `{ pinSet: boolean; label?: string }`. When `!pinSet`, renders a "Set an admin PIN in Settings" link instead of the input.
  - `AdminPinGate` (client): `{ unlocked: boolean; pinSet: boolean; children: ReactNode }` — renders children when unlocked, else `<AdminPinPrompt>`.

- [ ] **Step 1: Write the gate component**

Create `src/components/admin/pin-gate.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/admin/ui";
import { unlockAdmin } from "@/app/admin/_lib/actions-security";

export function AdminPinPrompt({
  pinSet,
  label = "Enter admin PIN to unlock",
}: {
  pinSet: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!pinSet) {
    return (
      <p className="text-[12px] text-muted">
        No admin PIN yet.{" "}
        <Link
          href="/admin/settings"
          className="font-semibold text-brand-700 hover:underline"
        >
          Set one in Settings
        </Link>{" "}
        to protect this action.
      </p>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await unlockAdmin(pin);
          if (!res.ok) setError(res.error);
          else {
            setPin("");
            router.refresh();
          }
        });
      }}
    >
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        placeholder={label}
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="max-w-[220px]"
      />
      <Button type="submit" variant="brand" size="sm" disabled={pending || pin.length < 4}>
        {pending ? "Unlocking…" : "Unlock"}
      </Button>
      {error && <span className="text-[12px] font-semibold text-bad">{error}</span>}
    </form>
  );
}

export function AdminPinGate({
  unlocked,
  pinSet,
  children,
}: {
  unlocked: boolean;
  pinSet: boolean;
  children: ReactNode;
}) {
  if (unlocked) return <>{children}</>;
  return <AdminPinPrompt pinSet={pinSet} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If `Input` doesn't accept `className`, wrap it in a `<div className="max-w-[220px]">` instead — check `src/components/ui/input.tsx` and adjust.)

- [ ] **Step 3: Write the PIN settings form**

Create `src/app/admin/settings/_components/pin-settings-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/admin/ui";
import { setAdminPin } from "@/app/admin/_lib/actions-security";

export function PinSettingsForm({ pinSet }: { pinSet: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="max-w-sm space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        start(async () => {
          const res = await setAdminPin({
            current: pinSet ? String(fd.get("current") || "") : undefined,
            next: String(fd.get("next") || ""),
          });
          if (!res.ok) setError(res.error);
          else {
            setOk(true);
            form.reset();
            router.refresh();
          }
        });
      }}
    >
      {pinSet && (
        <div className="space-y-1.5">
          <Label htmlFor="current">Current PIN</Label>
          <Input id="current" name="current" type="password" inputMode="numeric" required />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="next">{pinSet ? "New PIN" : "Set a PIN"}</Label>
        <Input
          id="next"
          name="next"
          type="password"
          inputMode="numeric"
          placeholder="4–8 digits"
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Saving…" : pinSet ? "Change PIN" : "Set PIN"}
        </Button>
        {ok && <span className="text-[12px] font-semibold text-good">Saved.</span>}
        {error && <span className="text-[12px] font-semibold text-bad">{error}</span>}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Write the settings page**

Create `src/app/admin/settings/page.tsx`:

```tsx
import { Card, CardHead, PageHeader, Pill } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { getAdminSecurityState } from "@/app/admin/_lib/actions-security";
import { PinSettingsForm } from "./_components/pin-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireRole("admin");
  const { pinSet, unlocked } = await getAdminSecurityState();

  return (
    <div className="space-y-6 max-w-[900px]">
      <PageHeader className="rise" eyebrow="Settings" title="Settings" />

      <Card className="rise">
        <CardHead
          title="Admin PIN"
          action={
            <Pill tone={pinSet ? (unlocked ? "good" : "info") : "warn"}>
              {pinSet ? (unlocked ? "Unlocked" : "Set") : "Not set"}
            </Pill>
          }
        />
        <div className="p-5 space-y-3">
          <p className="text-[13px] text-muted">
            The PIN protects sensitive actions — changing a user&apos;s role and
            deactivating accounts. One unlock lasts about 30 minutes.
          </p>
          <PinSettingsForm pinSet={pinSet} />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Add the Settings nav item**

In `src/components/admin/shell.tsx`, the "Insight" nav section currently is:

```tsx
  {
    heading: "Insight",
    items: [
      { label: "Reports", href: "/admin/reports", icon: <BarChart3 className={IC} /> },
    ],
  },
```

Add a Settings item (import `Settings` from `lucide-react` alongside the other icon imports at the top of the file):

```tsx
  {
    heading: "Insight",
    items: [
      { label: "Reports", href: "/admin/reports", icon: <BarChart3 className={IC} /> },
      { label: "Settings", href: "/admin/settings", icon: <Settings className={IC} /> },
    ],
  },
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/pin-gate.tsx src/app/admin/settings src/components/admin/shell.tsx
git commit -m "feat(admin-pin): settings page to set/change PIN + AdminPinGate component + nav"
```

---

### Task 5: Server enforcement + UI gating on the walled surfaces

**Files:**
- Modify: `src/app/admin/_lib/actions-users.ts` (enforce in `createUser`, `updateUser`, `setUserActive`)
- Modify: `src/app/admin/users/page.tsx` (pass `unlocked`/`pinSet` to create form + row actions)
- Modify: `src/app/admin/users/[id]/page.tsx` (pass `unlocked`/`pinSet` to edit form)
- Modify: `src/app/admin/users/_components/create-user-form.tsx` (gate the role select)
- Modify: `src/app/admin/users/_components/user-row-actions.tsx` (gate the deactivate/reactivate button)
- Modify: `src/app/admin/users/[id]/_components/edit-user-form.tsx` (gate the role select)

**Interfaces:**
- Consumes: `assertAdminUnlocked`, `isAdminUnlocked` (Task 2); `getPinHash` (Task 2) or `getAdminSecurityState` (Task 3) for `pinSet`; `AdminPinPrompt` (Task 4); `ADMIN_TIERS` from `@/lib/roles`.
- The server checks are the real boundary; the UI props (`unlocked`, `pinSet`) only decide whether to render the live control or the prompt.

- [ ] **Step 1: Enforce in the three user actions**

In `src/app/admin/_lib/actions-users.ts`:

Add the import near the top (after the existing imports):

```ts
import { assertAdminUnlocked } from "@/lib/admin-lock";
import { ADMIN_TIERS } from "@/lib/roles";
```

In `createUser`, immediately after `const data = createUserSchema.parse(input);`, add:

```ts
  // Creating a privileged account (admin tier or tutor) is a walled action.
  if (data.role === "tutor" || (ADMIN_TIERS as readonly string[]).includes(data.role)) {
    await assertAdminUnlocked();
  }
```

In `updateUser`, after `const data = updateUserSchema.parse(input);`, add a stored-role read and a conditional assert BEFORE the `withActor` update:

```ts
  // A role change is walled; a plain profile edit (no role change) stays open.
  const [before] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, data.id));
  if (before && before.role !== data.role) {
    await assertAdminUnlocked();
  }
```

In `setUserActive`, after `z.string().uuid().parse(id);`, add:

```ts
  await assertAdminUnlocked();
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (`db`, `profiles`, `eq` are already imported in this file.)

- [ ] **Step 3: Gate the create-user role select**

In `src/app/admin/users/_components/create-user-form.tsx`:

Add to the imports:

```ts
import { AdminPinPrompt } from "@/components/admin/pin-gate";
```

Change the component signature to accept the two props:

```tsx
export function CreateUserForm({
  unlocked,
  pinSet,
}: {
  unlocked: boolean;
  pinSet: boolean;
}) {
```

Replace the role `<div className="space-y-1.5">…</div>` block (the one containing the role `<Select>`) with a gated version:

```tsx
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <Select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          disabled={!unlocked}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        {!unlocked && (
          <div className="pt-1.5">
            <AdminPinPrompt pinSet={pinSet} label="Unlock to set privileged roles" />
          </div>
        )}
      </div>
```

Note: the server still blocks a privileged create even if the select is bypassed. A locked admin can still create students/parents (the default `student_restricted` is open); only tutor/admin creation is walled.

- [ ] **Step 4: Gate the edit-user role select**

In `src/app/admin/users/[id]/_components/edit-user-form.tsx`:

Add import:

```ts
import { AdminPinPrompt } from "@/components/admin/pin-gate";
```

Extend the props type with `unlocked: boolean; pinSet: boolean;` and destructure them (the component currently takes a single `props` object — add the two fields to its type and read `props.unlocked` / `props.pinSet`).

Replace the role field block with:

```tsx
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <Select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          disabled={!props.unlocked}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        {!props.unlocked && (
          <div className="pt-1.5">
            <AdminPinPrompt pinSet={props.pinSet} label="Unlock to change role" />
          </div>
        )}
      </div>
```

- [ ] **Step 5: Gate the deactivate/reactivate button**

In `src/app/admin/users/_components/user-row-actions.tsx`:

Add import:

```ts
import { AdminPinPrompt } from "@/components/admin/pin-gate";
```

Extend props with `unlocked: boolean; pinSet: boolean;`. When locked, render the deactivate/reactivate `<Button>` as `disabled`, and show the prompt. Minimal change: gate just the toggle button while leaving Open/Reset untouched:

```tsx
      <Button
        size="sm"
        variant={isActive ? "outline" : "primary"}
        disabled={pending || !unlocked}
        onClick={() => {
          const verb = isActive ? "Deactivate" : "Reactivate";
          if (
            !confirm(
              `${verb} ${name}? ${
                isActive
                  ? "They will lose portal access until reactivated."
                  : "They will be able to log in again."
              }`,
            )
          )
            return;
          start(async () => {
            await setUserActive(id, !isActive);
          });
        }}
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </Button>
```

Because row actions are inline per-row, don't render a prompt in every row. Instead the page renders ONE prompt above the table when locked (Step 6). Keep the button `disabled={!unlocked}` here; add `unlocked` to the destructured props. (`pinSet` is accepted for signature symmetry but the shared prompt lives on the page — you may omit `pinSet` from this component if unused; if you keep it, reference it or prefix with `_`.)

- [ ] **Step 6: Wire the props from the user pages**

In `src/app/admin/users/page.tsx`: import `getAdminSecurityState`, call it, and pass `unlocked`/`pinSet` into `<CreateUserForm>` and each `<UserRowActions>`. When `!unlocked`, render a single `AdminPinPrompt` in a small banner above the users table:

```tsx
import { getAdminSecurityState } from "@/app/admin/_lib/actions-security";
import { AdminPinPrompt } from "@/components/admin/pin-gate";
// ...
const { unlocked, pinSet } = await getAdminSecurityState();
// pass unlocked/pinSet to <CreateUserForm unlocked={unlocked} pinSet={pinSet} />
// and to <UserRowActions ... unlocked={unlocked} />
// and, above the table when locked:
{!unlocked && (
  <Card>
    <div className="flex items-center justify-between gap-4 p-4">
      <p className="text-[13px] text-muted">
        Role changes and deactivation are locked.
      </p>
      <AdminPinPrompt pinSet={pinSet} label="Unlock admin actions" />
    </div>
  </Card>
)}
```

In `src/app/admin/users/[id]/page.tsx`: call `getAdminSecurityState()` and pass `unlocked`/`pinSet` into `<EditUserForm … unlocked={unlocked} pinSet={pinSet} />`.

(Read each page first to place these against the existing JSX — exact insertion points depend on current layout. The invariants: every `<CreateUserForm>`, `<EditUserForm>`, and `<UserRowActions>` receives `unlocked` (+ `pinSet` where it renders its own prompt).)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Fix any prop-type mismatches until clean.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin
git commit -m "feat(admin-pin): wall role changes + deactivation (server-enforced + UI gate)"
```

---

### Task 6: Runtime verification + memory update

**Files:**
- None (verification) — plus a memory pointer update.

- [ ] **Step 1: Final typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Start the dev server (user runs this themselves)**

Ask the user to run `npm run dev` (per project rule: do not start the dev server unsolicited). Then walk the checklist below in the browser as `admin@…` (or the seeded admin).

- [ ] **Step 3: Runtime checklist (must all hold)**

1. `/admin/settings` shows "Not set" → set PIN `1234` → chip flips to "Set".
2. `/admin/users`: while locked, the create-form role `<Select>` is disabled, each row's Deactivate button is disabled, and the "Unlock admin actions" banner shows.
3. Enter `1234` in the banner → page refreshes → role select + deactivate buttons become enabled.
4. Change a test user's role and save → succeeds. Deactivate + reactivate a test user → succeeds.
5. Wrong PIN in the prompt → "Incorrect PIN"; controls stay locked.
6. **Server boundary:** with the cookie cleared (or after 30 min), calling a walled action directly still fails. Quick proof: in the browser devtools console on `/admin`, run a fetch that invokes `setUserActive` via the server-action endpoint while locked — expect it to throw "Admin unlock required". (Or simply confirm the disabled controls can't be triggered and trust the `assertAdminUnlocked()` calls added in Task 5; the enable/disable is driven by the same `isAdminUnlocked()`.)
7. Editing a user's name/phone WITHOUT changing role, while locked, still saves (only role changes are walled).

- [ ] **Step 4: Update the auto-memory pointer**

Update `project_role_tiers_spec1_2026_07_10.md` (the "Admin split" paragraph): change status from "spec'd, NOT yet built" to "BUILT + verified <date>" with the migration number (0020) and the final scope (revenue deferred — not surfaced yet; walled = role changes + deactivation). Keep `MEMORY.md`'s one-liner in sync.

- [ ] **Step 5: Commit any remaining docs**

```bash
git add docs/superpowers
git commit -m "docs(admin-pin): implementation plan + status"
```

---

## Self-Review

**Spec coverage:**
- Storage (`admin_settings`, migration 0020, RLS on, no client policies) → Task 1. ✓
- scrypt hash `"<salt>:<hash>"` + `timingSafeEqual` verify → Task 2. ✓
- Set/change PIN `/admin/settings` + `setAdminPin` bootstrap-vs-current logic → Tasks 3–4. ✓
- `unlockAdmin` + signed httpOnly cookie (HMAC, 30 min, user-bound, path=/admin) → Tasks 2–3. ✓
- `isAdminUnlocked` / `assertAdminUnlocked` in `src/lib/admin-lock.ts` → Task 2. ✓
- `<AdminPinGate>` + prompt, "set a PIN" link when unset → Task 4. ✓
- Server enforcement in `updateUser` (role diff), `createUser` (admin/tutor), `setUserActive` → Task 5. ✓
- Signing key `ADMIN_PIN_SECRET ?? SUPABASE_SERVICE_ROLE_KEY`, throw if absent → Task 2 (`signingKey()`). ✓
- Error handling: wrong PIN generic message, no PIN set → routes to settings, missing key → clear throw → Tasks 2–3. ✓
- **Revenue walling** → intentionally DEFERRED per user decision 2026-07-12 (no revenue rendered today); helpers/component make it a one-step add later. Documented in Global Constraints. ✓ (deviation from spec, approved)
- Reactivation walled for symmetry → Task 5 (`setUserActive` asserts for BOTH activate and deactivate). ✓

**Placeholder scan:** No "TODO"/"handle edge cases"/"similar to Task N" — every code step has real code. Task 5 Step 6 says "read each page first to place these" because the two user pages' exact JSX wasn't captured in the plan; the invariant (which props each component must receive) is stated explicitly, so it's directed, not a placeholder.

**Type consistency:** `hashPin`/`verifyPin`/`getPinHash`/`upsertPinHash`/`setUnlockCookie`/`isAdminUnlocked`/`assertAdminUnlocked` names are identical across Tasks 2/3/5. `AdminPinPrompt` props `{ pinSet, label? }` and `AdminPinGate` props `{ unlocked, pinSet, children }` are consistent across Task 4 and their consumers in Task 5. `getAdminSecurityState()` returns `{ pinSet, unlocked }` — consumed with those exact names in Tasks 4–5. ✓
