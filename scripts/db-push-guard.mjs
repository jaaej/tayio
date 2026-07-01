// Guard for `npm run db:push`. drizzle-kit push DROPS every RLS policy and the
// lesson_notes_safe view, because they live in raw SQL (supabase/migrations/),
// not src/db/schema.ts — so it silently wipes row-level security on ALL tables.
// This guard blocks the accidental path and points to the safe workflow.

console.error(`
⛔  db:push is disabled in this repo — it WIPES row-level security.

    drizzle-kit push drops every RLS policy + the lesson_notes_safe view,
    because they live in supabase/migrations/*.sql, not src/db/schema.ts.
    Running it leaves every table wide open until all RLS is re-applied.

    To make a schema change safely:
      1. Update src/db/schema.ts (for Drizzle types), AND
      2. Write the DDL as a raw-SQL ALTER in supabase/migrations/NNNN_*.sql
         and apply it:  node scripts/apply-sql.mjs supabase/migrations/NNNN_*.sql
      3. Verify RLS survived:  npm run db:check-rls

    If you truly must run drizzle-kit push (and will re-apply ALL RLS after,
    with the dev server stopped), run it directly:  npx drizzle-kit push
`);
process.exit(1);
