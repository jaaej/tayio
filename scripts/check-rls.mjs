// Audits row-level security across every public table. Exits non-zero if any
// table has RLS disabled or zero policies - so an accidental RLS wipe (e.g. from
// `drizzle-kit push`, which drops all policies not declared in schema.ts) is
// caught immediately instead of going unnoticed. Run after ANY database change.
//
// Usage: node scripts/check-rls.mjs   (or: npm run db:check-rls)

import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL or DATABASE_URL not set in .env.local");
  process.exit(1);
}

// These server-only tables intentionally have RLS enabled with zero policies.
// In Postgres that is deny-by-default for anon/authenticated, not unprotected.
// App access uses the server-side postgres connection after role checks.
const ALLOW_NO_RLS = new Set([
  "admin_settings", // PIN hash + lockout state, migration 0020
  "math_game_scores", // app-validated score writes, migration 0022
  "reschedule_requests", // role-guarded workflow, migration 0019
  "class_credits", // role-guarded workflow, migration 0031
  "lesson_cancellations", // role-guarded workflow, migration 0031
  "allowance_adjustments", // admin-only allowance top-ups, migration 0032
  "student_leave", // admin-managed leave/holiday periods, migration 0033
  "tutor_bank_details", // owner-only tutor payroll PII, migration 0035
]);

const sql = postgres(url, { prepare: false, max: 1 });
const rows = await sql`
  select c.relname,
         c.relrowsecurity as rls,
         (select count(*)::int from pg_policies p
            where p.schemaname = 'public' and p.tablename = c.relname) as pol
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname`;
await sql.end();

const bad = rows.filter(
  (r) => !ALLOW_NO_RLS.has(r.relname) && (!r.rls || r.pol === 0),
);

for (const r of rows) {
  const status = ALLOW_NO_RLS.has(r.relname)
    ? "deny"
    : !r.rls || r.pol === 0
      ? "FAIL"
      : "ok";
  console.log(
    `${status.padEnd(4)} ${r.relname.padEnd(26)} rls=${r.rls ? "on " : "OFF"} policies=${r.pol}`,
  );
}

if (bad.length) {
  console.error(
    `\n❌ ${bad.length} table(s) unprotected: ${bad.map((b) => b.relname).join(", ")}`,
  );
  console.error(
    "   This usually means an RLS wipe (did something run `drizzle-kit push`?).",
  );
  console.error(
    "   Fix: stop the dev server, then re-apply supabase/migrations/0003–0012 in order",
  );
  console.error(
    "   with `node scripts/apply-sql.mjs <file>`, and re-run this check.",
  );
  process.exit(1);
}

console.log(
  `\n✅ All ${rows.length} public tables have RLS enabled with policies or an intentional deny-all configuration.`,
);
