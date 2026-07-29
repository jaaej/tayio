// Apply a raw SQL file to the database. Used for files in supabase/migrations/.
// Usage: node scripts/apply-sql.mjs supabase/migrations/0001_profile_sync_trigger.sql
//
// Prefers DIRECT_URL (session pooler, :5432) over DATABASE_URL (transaction
// pooler, :6543). DDL - functions, triggers, RLS, views - must go through the
// session pooler; the transaction pooler doesn't support advisory locks,
// prepared statements, or session-level state reliably.

import { readFile } from "node:fs/promises";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/apply-sql.mjs <path-to-sql>");
  process.exit(1);
}

const connUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connUrl) {
  console.error("DIRECT_URL (preferred for DDL) or DATABASE_URL not set in .env.local");
  process.exit(1);
}
console.log(`using ${process.env.DIRECT_URL ? "DIRECT_URL (session pooler)" : "DATABASE_URL"}`);

const sql = postgres(connUrl, { prepare: false, max: 1 });
const text = await readFile(file, "utf8");

try {
  await sql.unsafe(text);
  console.log(`✓ applied ${file}`);
} catch (e) {
  console.error(`✗ ${file}: ${e.message}`);
  process.exit(1);
} finally {
  await sql.end();
}
