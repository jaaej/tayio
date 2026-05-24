// One-shot script: rename existing test users from @tayio.com to @taiyo.com.
// Also updates the matching profiles row.
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const renames = [
  ["admin@tayio.com", "admin@taiyo.com"],
  ["student@tayio.com", "student@taiyo.com"],
  ["parent@tayio.com", "parent@taiyo.com"],
  ["tutor@tayio.com", "tutor@taiyo.com"],
];

const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });

for (const [oldEmail, newEmail] of renames) {
  const user = list.users.find((u) => u.email === oldEmail);
  if (!user) {
    console.log(`- ${oldEmail} not found (already renamed?)`);
    continue;
  }
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email: newEmail,
    email_confirm: true,
  });
  if (error) {
    console.error(`✗ ${oldEmail} → ${newEmail}: ${error.message}`);
    continue;
  }
  await sql`update profiles set email = ${newEmail} where id = ${user.id}`;
  console.log(`✓ ${oldEmail} → ${newEmail}`);
}

await sql.end();
console.log("\nDone.");
process.exit(0);
