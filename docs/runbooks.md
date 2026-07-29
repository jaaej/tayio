# Operational Runbooks

Incident-response procedures for tayio_portal. Covers security-checklist items
**I3** (incident response), **I4** (service-role key compromise), **I5** (admin
account compromise), **I6** (migration rollback).

**Stack recap:** Next.js (Vercel) · Supabase (Postgres + Auth + Storage) ·
Drizzle ORM. Secrets live in `.env.local` (local) and Vercel env vars (prod).
Students are minors → any personal-data breach has mandatory-reporting
implications (see §I3, step 6).

---

## I3 - Incident response (general)

Use this when you suspect any breach: leaked credentials, unexpected data
access, RLS failure, defacement, suspicious audit-log entries.

1. **Triage & record.** Note the time, what you observed, and how. Start a
   timestamped log of every action you take from here (needed for reporting).
2. **Contain.**
   - Suspected credential leak → rotate it (§I4 for the service-role key).
   - Suspected account takeover → disable the account (`setUserActive(id, false)`
     in the admin portal, or in Supabase dashboard → Authentication → Users →
     ban). For admin takeover, §I5.
   - Active data exfiltration / defacement → put the app in maintenance: in
     Vercel, redeploy a maintenance page or pause the deployment; or in Supabase
     dashboard → Settings → API, rotate keys to cut client access.
3. **Assess scope.** Query the audit trail (admin-only):
   ```sql
   select * from public.audit_logs
   where created_at > now() - interval '48 hours'
   order by created_at desc;
   ```
   Cross-check with Supabase logs: Dashboard → Logs → (Auth / Postgres / Storage).
   Identify which users/rows were touched and by whom (`actor_id`; NULL = server
   context, not a logged-in user).
4. **Eradicate.** Remove the attacker's access (rotated keys, banned accounts,
   patched vuln). If a code vuln, fix + deploy before restoring access.
5. **Recover.** Restore data from backup if integrity was affected (§I6 for
   schema; Supabase PITR for data - Dashboard → Database → Backups). Verify with
   `npm run db:check-rls` that RLS is intact after any restore.
6. **Notify (minors - do not skip).** If personal data of a minor was or may
   have been accessed/disclosed:
   - Assess against the **Australian Privacy Act / Notifiable Data Breaches
     scheme** (eligible data breach → notify the OAIC and affected
     individuals/guardians).
   - If the incident involves conduct toward a child, the **Victorian
     Reportable Conduct Scheme** / Child Safe Standards may require reporting to
     the Commission for Children and Young People.
   - This is not legal advice - engage the org's privacy officer / legal counsel
     immediately. Do this in parallel with technical recovery, not after.
7. **Post-incident.** Write up: timeline, root cause, blast radius, fix, and a
   prevention item. Add a regression test or checklist entry.

---

## I4 - Service-role key compromise

The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS entirely - it is
the highest-value secret. It's used only server-side in
`src/app/admin/_lib/supabase-admin.ts` (auth user CRUD). If it leaks (committed
to git, pasted somewhere, exposed in a client bundle), treat as full DB
compromise.

1. **Rotate immediately.** Supabase Dashboard → Project Settings → API →
   "Reset" / "Roll" the `service_role` key. This invalidates the old key.
   (Note: rolling keys also affects the anon/JWT secret family - confirm which
   Supabase exposes; on newer projects use the API keys page.)
2. **Update where it's stored:**
   - Local: `.env.local` → `SUPABASE_SERVICE_ROLE_KEY=...`
   - Prod: Vercel → Project → Settings → Environment Variables → update →
     **redeploy** (env changes need a new deployment to take effect).
   - Any CI / scripts that use it.
3. **Confirm no lingering use of the old key** - grep deploy logs; the old key
   now returns 401.
4. **Assess what the key could have touched** while exposed: it bypasses RLS, so
   assume all tables were readable/writable. Review `audit_logs` and Supabase
   Postgres logs for anomalous activity in the exposure window.
5. **If it was committed to git:** rotating is sufficient to kill access, but the
   key remains in history - rewrite history (`git filter-repo`) or, simpler,
   treat the rotated key as dead and move on. Never rely on deleting the file in
   a later commit (history keeps it).
6. **Verify:** confirm the app still works with the new key (admin user
   create/update), and `npm run db:check-rls` passes.

**Prevention:** `.env*` is gitignored (checklist D1); `supabase-admin.ts` and
`db/client.ts` carry `import "server-only"` so the key can't be bundled
client-side (J4).

---

## I5 - Admin account compromise

An admin account is nearly as powerful as the service-role key (user management,
role changes, payments, reads all data). If an admin account is taken over:

1. **Lock the account.** Supabase Dashboard → Authentication → Users → find the
   admin → **Ban** (or set a long ban). This immediately blocks new sign-ins;
   also invalidate existing sessions: Dashboard → Authentication → Users →
   revoke the user's sessions (or force a global sign-out by rotating the JWT
   secret if you can't target one user).
2. **Reset the password** for that account and re-enable only after confirming
   the legitimate owner controls it + MFA is on (see prevention).
3. **Audit what the compromised admin did:**
   ```sql
   select * from public.audit_logs
   where actor_id = '<admin-user-id>'
   order by created_at desc;
   ```
   Pay special attention to `action = 'UPDATE'` on `profiles` with a `role`
   change (privilege escalation of another account), new `family_links`
   (parent↔child re-linking), and `invoices`.
4. **Reverse malicious changes** using the `old_data` JSONB captured in each
   audit row. Re-check for any *other* accounts whose role was elevated.
5. **Check for planted persistence:** new admin accounts, altered family links,
   changed emails. List admins:
   ```sql
   select id, first_name, last_name, role from public.profiles where role = 'admin';
   ```
6. If data was exfiltrated → escalate to §I3 step 6 (breach notification).

**Prevention:** enable **MFA/TOTP for admin accounts** (Supabase supports it,
checklist B10); keep the admin count minimal; `profiles.role` is trigger-locked
(migration 0013) so a non-admin can't self-promote even with a DB foothold.

---

## I6 - Migration rollback

Migrations live in `supabase/migrations/` (raw SQL, RLS/triggers/functions) and
`src/db/schema.ts` (Drizzle table DDL). Each migration in `docs/SECURITY.md` has
a **"Reversible by"** block - that is the authoritative rollback for that file.

**General procedure:**

1. **Stop the dev server** before applying/reverting any RLS or DDL change - its
   open connections hold locks that block `ALTER TABLE … ENABLE RLS` and
   `CREATE TRIGGER`. Kill `next dev` *and* its child workers:
   ```bash
   pkill -f "next dev"; pkill -f "next-server"
   ```
2. **Find the reversal SQL** in `docs/SECURITY.md` under the migration's entry
   (e.g. 0013 → `drop trigger … ; drop function …`). Put it in a `.sql` file.
3. **Apply it** through the session pooler (required for DDL):
   ```bash
   node scripts/apply-sql.mjs path/to/rollback.sql
   ```
   `apply-sql.mjs` prefers `DIRECT_URL` (session pooler `:5432`); never use the
   transaction pooler (`:6543`) for DDL.
4. **Re-audit:** `npm run db:check-rls` - must report all tables RLS-protected.
5. If the migration was paired with a `schema.ts` change, revert that too
   (edit `schema.ts` back; do **not** run `db:push` - it wipes RLS).

**⛔ Never run `npm run db:push` / `drizzle-kit push` as a rollback.** It
reconciles the DB to `schema.ts` and, because RLS policies + the
`lesson_notes_safe` view live only in raw SQL, it **drops all RLS + policies +
the view** across every table (this caused a full RLS wipe on 2026-07-01). It's
guarded by `scripts/db-push-guard.mjs`. If it ever runs anyway: re-apply
`supabase/migrations/0003`–(latest) in order with the dev server stopped, then
`npm run db:check-rls`.

**Data (not schema) rollback:** use Supabase point-in-time recovery - Dashboard
→ Database → Backups → restore to a timestamp. Confirm PITR is enabled first
(checklist I1); untested backups are wishes (I2).

---

## Quick reference

| Situation | Runbook | First move |
|---|---|---|
| Any suspected breach | I3 | Record time + contain |
| `SUPABASE_SERVICE_ROLE_KEY` leaked | I4 | Rotate in Supabase dashboard |
| Admin account taken over | I5 | Ban account + revoke sessions |
| Bad migration applied | I6 | Stop dev server, apply "Reversible by" SQL |
| RLS wiped (db:push ran) | I6 | Re-apply 0003–latest, `db:check-rls` |
| Data corrupted/deleted | I3/I6 | Supabase PITR restore |
