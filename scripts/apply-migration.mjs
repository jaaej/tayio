import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { readFileSync } from "node:fs";

loadEnv({ path: ".env.local" });
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) { console.error("no DB url"); process.exit(1); }

const files = process.argv.slice(2);
const sql = postgres(url, { prepare: false, max: 1 });
try {
  for (const f of files) {
    const content = readFileSync(f, "utf8");
    process.stdout.write(`Applying ${f} ... `);
    await sql.unsafe(content);
    console.log("OK");
  }
  console.log("All migrations applied.");
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
