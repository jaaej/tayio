// Applies raw-SQL migrations and records them in the schema_migrations ledger,
// so "which migrations does this database have?" is a query rather than an
// archaeology exercise. See scripts/migration-ledger.mjs for why the ledger
// exists.
//
// Usage:
//   node scripts/apply-migration.mjs supabase/migrations/0041_x.sql   apply (skips if already recorded)
//   npm run db:status                                                list applied vs pending
//   node scripts/apply-migration.mjs --stamp <files...>               record as applied WITHOUT running
//   node scripts/apply-migration.mjs --force <files...>               run even if already recorded
//
// --stamp is for adopting the ledger on a database whose migrations were
// applied before it existed, and for repairing the rare case where a migration
// ran but its ledger row did not land.

import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ensureLedger, appliedSet, record } from "./migration-ledger.mjs";

loadEnv({ path: ".env.local" });

const MIGRATIONS_DIR = "supabase/migrations";

const argv = process.argv.slice(2);
const stamp = argv.includes("--stamp");
const force = argv.includes("--force");
const status = argv.includes("--status");
const files = argv.filter((a) => !a.startsWith("--"));

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL or DATABASE_URL not set in .env.local");
  process.exit(1);
}

// Host only - never print the password.
const target = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable url)";
  }
})();

const sql = postgres(url, { prepare: false, max: 1 });

try {
  await ensureLedger(sql);
  const applied = await appliedSet(sql);

  if (status) {
    const onDisk = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const pending = onDisk.filter((f) => !applied.has(f));
    // Recorded here but absent from this checkout - e.g. applied from a branch
    // that was never merged. Worth surfacing; not an error.
    const offBranch = [...applied].filter((f) => !onDisk.includes(f)).sort();

    // Count against what is on disk, not the ledger total - off-branch rows
    // would otherwise produce "40 of 37".
    const here = onDisk.filter((f) => applied.has(f)).length;
    console.log(`\n${target}`);
    console.log(`  applied: ${here} of ${onDisk.length} on disk`);
    if (pending.length > 0) {
      console.log(`\n  PENDING (${pending.length}):`);
      for (const f of pending) console.log(`    ${f}`);
    } else {
      console.log("\n  up to date");
    }
    if (offBranch.length > 0) {
      console.log(`\n  RECORDED BUT NOT IN THIS CHECKOUT (${offBranch.length}):`);
      for (const f of offBranch) console.log(`    ${f}`);
    }
    console.log("");
  } else if (files.length === 0) {
    console.error(
      "\nNo migration files given.\n\n" +
        "  node scripts/apply-migration.mjs supabase/migrations/NNNN_*.sql\n" +
        "  npm run db:status\n",
    );
    process.exitCode = 1;
  } else {
    console.log(`\n${stamp ? "Stamping" : "Applying"} against ${target}\n`);
    let changed = 0;

    for (const file of files) {
      const name = path.basename(file);

      if (stamp) {
        await record(sql, name);
        console.log(`  ${name} ... recorded (not run)`);
        changed++;
        continue;
      }

      if (applied.has(name) && !force) {
        console.log(`  ${name} ... already applied, skipping`);
        continue;
      }

      process.stdout.write(`  ${name} ... `);
      await sql.unsafe(readFileSync(file, "utf8"));
      await record(sql, name);
      console.log("OK");
      changed++;
    }

    console.log(
      `\n${changed} migration(s) ${stamp ? "recorded" : "applied"}.` +
        (stamp ? "\n" : "\nNow run: npm run db:check-rls\n"),
    );
  }
} catch (error) {
  console.error(`\nFAILED: ${error.message}`);
  console.error(
    "\nThe ledger only records migrations that completed, so re-running this\n" +
      "command resumes from the file that failed. If a migration ran but its\n" +
      "ledger row did not land, record it with --stamp <file>.\n",
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
