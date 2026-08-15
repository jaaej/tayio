// Shared migration ledger, used by apply-migration.mjs and bootstrap-db.mjs.
//
// Why: nothing used to record which migrations had been applied to which
// database. With one database that was survivable - you remembered, or you read
// docs/checklist.md. It already failed once (the dev database has term-test
// tables that main's migrations cannot create), and with a dev AND a prod
// database it would fail again in a way that is much more expensive.
//
// The ledger is infrastructure for migrations, not part of the application
// schema, so it deliberately does NOT live in src/db/schema.ts - Drizzle has no
// business knowing about it. It is created idempotently here instead of by a
// numbered migration, because it has to exist before the first migration can be
// recorded.
//
// RLS: enabled with no policies - deny-by-default for anon/authenticated. Only
// the scripts, connecting as postgres, ever touch it. It is in check-rls.mjs's
// ALLOW_NO_RLS set so `db:check-rls` reports it as an intentional deny-all.

export const LEDGER_TABLE = "schema_migrations";

/** Creates the ledger if absent. Safe to call on every run. */
export async function ensureLedger(sql) {
  await sql.unsafe(`
    create table if not exists public.${LEDGER_TABLE} (
      filename    text primary key,
      applied_at  timestamptz not null default now()
    );
    alter table public.${LEDGER_TABLE} enable row level security;
  `);
}

/** Filenames (basenames) already recorded as applied. */
export async function appliedSet(sql) {
  const rows = await sql.unsafe(
    `select filename from public.${LEDGER_TABLE}`,
  );
  return new Set(rows.map((r) => r.filename));
}

/**
 * Records a migration as applied.
 *
 * Called immediately AFTER the migration's own SQL, not inside it: every
 * migration file already opens and commits its own transaction, so there is no
 * outer transaction to join. That leaves a very small window where a crash
 * between the two statements applies a migration without recording it. The
 * recovery is to re-stamp it by hand (`--stamp <file>`), which is why that flag
 * exists.
 */
export async function record(sql, filename) {
  await sql.unsafe(
    `insert into public.${LEDGER_TABLE} (filename) values ($1)
     on conflict (filename) do nothing`,
    [filename],
  );
}
