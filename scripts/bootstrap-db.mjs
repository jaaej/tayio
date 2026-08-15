// One-shot schema bootstrap for a BRAND NEW, EMPTY database (i.e. the
// production Supabase project on deploy day).
//
// Why this script exists: `supabase/migrations/*.sql` cannot build a database
// from nothing. None of those files create the core tables (profiles, classes,
// enrollments, lessons, ...) - they only ALTER, add RLS, and create later
// tables. The base schema lives in `src/db/schema.ts` and only ever reached the
// dev database via `drizzle-kit push`. So a fresh database needs, in order:
//
//   1. drizzle-kit push   - creates the tables, with NO row-level security
//   2. every migration    - adds RLS, policies, triggers, views, later tables
//   3. db:check-rls       - proves step 2 actually took
//
// That order is only safe on an empty database. Running push against a
// populated one wipes every RLS policy and the lesson_notes_safe view, which is
// why `npm run db:push` is blocked outright (scripts/db-push-guard.mjs). This
// script therefore REFUSES to run unless the target public schema has zero
// tables - it cannot be turned against a live database by accident.
//
// Usage:
//   DIRECT_URL / DATABASE_URL must point at the NEW project.
//   node scripts/bootstrap-db.mjs --confirm

import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

loadEnv({ path: ".env.local" });

const MIGRATIONS_DIR = "supabase/migrations";

if (!process.argv.includes("--confirm")) {
  console.error(
    "\nRefusing to run without --confirm.\n\n" +
      "  node scripts/bootstrap-db.mjs --confirm\n\n" +
      "Point DIRECT_URL at the NEW, EMPTY database first.\n",
  );
  process.exit(1);
}

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL or DATABASE_URL not set in .env.local");
  process.exit(1);
}

// Never print the password; the host is enough to see which project this is.
const target = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable url)";
  }
})();

const sql = postgres(url, { prepare: false, max: 1 });

const existing = await sql`
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname`;

if (existing.length > 0) {
  await sql.end();
  console.error(
    `\n⛔  ${target} already has ${existing.length} table(s) in public:\n` +
      `    ${existing.map((r) => r.relname).join(", ")}\n\n` +
      "    This script only bootstraps an EMPTY database. Running drizzle-kit\n" +
      "    push here would drop every RLS policy and the lesson_notes_safe\n" +
      "    view. To change an existing schema, write a raw-SQL ALTER migration\n" +
      "    and apply it with scripts/apply-migration.mjs instead.\n",
  );
  process.exit(1);
}
await sql.end();

console.log(`\nBootstrapping empty database at ${target}\n`);

console.log("1/3  drizzle-kit push (creating tables, no RLS yet)");
execFileSync("npx", ["drizzle-kit", "push", "--force"], { stdio: "inherit" });

console.log("\n2/3  applying migrations");
const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort() // zero-padded NNNN_ prefixes, so lexical order is numeric order
  .map((f) => path.join(MIGRATIONS_DIR, f));

if (files.length === 0) {
  console.error(`No .sql files found in ${MIGRATIONS_DIR}`);
  process.exit(1);
}

const migrate = postgres(url, { prepare: false, max: 1 });
try {
  for (const file of files) {
    process.stdout.write(`     ${path.basename(file)} ... `);
    await migrate.unsafe(readFileSync(file, "utf8"));
    console.log("OK");
  }
} catch (error) {
  console.error(`\nFAILED: ${error.message}`);
  console.error(
    "\nThe database is now half-migrated. Fix the migration, then either\n" +
      "re-run the remaining files with scripts/apply-migration.mjs or drop the\n" +
      "public schema and start this script over.\n",
  );
  process.exitCode = 1;
  await migrate.end();
  process.exit(1);
} finally {
  await migrate.end();
}

console.log("\n3/3  verifying row-level security");
execFileSync("node", ["scripts/check-rls.mjs"], { stdio: "inherit" });

console.log(
  "\n✅  Schema bootstrapped. Next: create the storage buckets and the first\n" +
    "    admin account - see docs/deploy.md.\n",
);
