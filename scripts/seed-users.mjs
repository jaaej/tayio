import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  {
    email: "admin@taiyo.com",
    password: "admin",
    role: "admin_unrestricted",
    first_name: "Admin",
    last_name: "Tayio",
  },
  {
    email: "student@taiyo.com",
    password: "student",
    role: "student_restricted",
    first_name: "Sarah",
    last_name: "Student",
  },
  {
    // Older / independently-enrolled student: self-manages billing + can DM
    // the admin office + (later) reschedule. See the role-tiers spec.
    email: "student.pro@taiyo.com",
    password: "student",
    role: "student_unrestricted",
    first_name: "Uma",
    last_name: "Unrestricted",
  },
  {
    email: "parent@taiyo.com",
    password: "parent",
    role: "parent",
    first_name: "Pat",
    last_name: "Parent",
  },
  {
    email: "tutor@taiyo.com",
    password: "tutor",
    role: "tutor",
    first_name: "Tom",
    last_name: "Tutor",
  },
];

async function upsertUser(u) {
  // If user already exists, look them up by listing and matching email
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
  const found = existing?.users?.find((x) => x.email === u.email);

  let userId;
  if (found) {
    const { data, error } = await admin.auth.admin.updateUserById(found.id, {
      password: u.password,
      email_confirm: true,
      app_metadata: {
        role: u.role,
        first_name: u.first_name,
        last_name: u.last_name,
      },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`↻ updated ${u.email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      app_metadata: {
        role: u.role,
        first_name: u.first_name,
        last_name: u.last_name,
      },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`✓ created ${u.email}`);
  }

  // Upsert matching profiles row
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      role: u.role,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (profileErr) throw profileErr;
}

for (const u of users) {
  try {
    await upsertUser(u);
  } catch (e) {
    console.error(`✗ ${u.email}: ${e.message}`);
  }
}

console.log("\nDone.");
process.exit(0);
