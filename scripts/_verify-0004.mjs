// Impersonate each role via SET LOCAL request.jwt.claims + SET LOCAL ROLE
// authenticated, then probe RLS. Pure read-only.

import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL, { prepare: false, max: 1 });

// ---------- helpers ----------------------------------------------------------

async function lookupUser(email) {
  const [row] = await sql`select id, email, raw_app_meta_data->>'role' as role from auth.users where email = ${email}`;
  if (!row) throw new Error(`no auth.users row for ${email}`);
  return row;
}

async function asUser(user, fn) {
  const claims = JSON.stringify({ sub: user.id, role: "authenticated", app_metadata: { role: user.role } });
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role authenticated`);
    await tx.unsafe(`set local request.jwt.claims = '${claims.replace(/'/g, "''")}'`);
    return fn(tx);
  });
}

async function asAnon(fn) {
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role anon`);
    await tx.unsafe(`set local request.jwt.claims = '{}'`);
    return fn(tx);
  });
}

function expect(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${label} - got ${actual}, expected ${expected}`);
  if (!ok) process.exitCode = 1;
}

// ---------- setup ----------------------------------------------------------

const admin = await lookupUser("admin@taiyo.com");
const tutor = await lookupUser("tutor@taiyo.com");
const studentA = await lookupUser("student@taiyo.com");
const studentB = await lookupUser("daniel.kim@taiyo.com");
const parentA = await lookupUser("parent@taiyo.com");
const parentB = await lookupUser("kim@taiyo.com");

console.log("Looked up:");
console.log(" ", admin.email, admin.id, admin.role);
console.log(" ", tutor.email, tutor.id, tutor.role);
console.log(" ", studentA.email, studentA.id, studentA.role);
console.log(" ", studentB.email, studentB.id, studentB.role);
console.log(" ", parentA.email, parentA.id, parentA.role);
console.log("");

// ---------- anon must see NOTHING -------------------------------------------

const anonProfiles = await asAnon((tx) => tx`select count(*)::int as n from public.profiles`);
expect("anon: profiles count", anonProfiles[0].n, 0);

const anonLessonNotes = await asAnon((tx) => tx`select count(*)::int as n from public.lesson_notes`);
expect("anon: lesson_notes count", anonLessonNotes[0].n, 0);

const anonHomework = await asAnon((tx) => tx`select count(*)::int as n from public.homework`);
expect("anon: homework count", anonHomework[0].n, 0);

// ---------- studentA: can only see own data ---------------------------------

const sAProfiles = await asUser(studentA, (tx) => tx`select id from public.profiles`);
const seesSelf = sAProfiles.some((r) => r.id === studentA.id);
const seesOtherStudent = sAProfiles.some((r) => r.id === studentB.id);
expect("studentA: sees own profile", seesSelf, true);
expect("studentA: does NOT see studentB profile", seesOtherStudent, false);

const sAHomeworkOther = await asUser(studentA, (tx) =>
  tx`select count(*)::int as n from public.homework_assignments where student_id = ${studentB.id}`,
);
expect("studentA: cannot read studentB's homework_assignments", sAHomeworkOther[0].n, 0);

const sAOwnHomework = await asUser(studentA, (tx) =>
  tx`select count(*)::int as n from public.homework_assignments where student_id = ${studentA.id}`,
);
console.log(`  (studentA own homework_assignments count: ${sAOwnHomework[0].n} - informational)`);

// lesson_notes base table - student must get ZERO rows
const sALessonNotesBase = await asUser(studentA, (tx) =>
  tx`select count(*)::int as n from public.lesson_notes`,
);
expect("studentA: cannot read lesson_notes base table", sALessonNotesBase[0].n, 0);

// lesson_notes_safe view - student should see own
const sASafeNotes = await asUser(studentA, (tx) =>
  tx`select count(*)::int as n from public.lesson_notes_safe where student_id != ${studentA.id}`,
);
expect("studentA: lesson_notes_safe returns 0 rows for OTHER students", sASafeNotes[0].n, 0);

// confirm column shape - internal_note column should not exist on the view
const safeCols = await sql`
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'lesson_notes_safe'
`;
const internalLeak = safeCols.some((c) => c.column_name === "internal_note");
expect("lesson_notes_safe excludes internal_note", internalLeak, false);

// invoices - studentA must not see other parents' invoices
const sAInvoicesOther = await asUser(studentA, (tx) =>
  tx`select count(*)::int as n from public.invoices where parent_id = ${parentB.id}`,
);
expect("studentA: cannot see parentB's invoices", sAInvoicesOther[0].n, 0);

// ---------- parentA: sees own children's data, not other families ----------

const pAClassesOther = await asUser(parentA, (tx) =>
  tx`select count(*)::int as n from public.enrollments where student_id = ${studentB.id}`,
);
expect("parentA: cannot see studentB enrollments (not linked)", pAClassesOther[0].n, 0);

// parentA IS linked to studentA per seed-demo
const pAOwnFamily = await asUser(parentA, (tx) =>
  tx`select count(*)::int as n from public.family_links where parent_id = ${parentA.id}`,
);
console.log(`  (parentA own family_links count: ${pAOwnFamily[0].n} - informational)`);

const pAOtherFamily = await asUser(parentA, (tx) =>
  tx`select count(*)::int as n from public.family_links where parent_id = ${parentB.id}`,
);
expect("parentA: cannot see parentB's family_links", pAOtherFamily[0].n, 0);

// ---------- tutor: sees own classes only ----------------------------------

const tutorOtherClasses = await asUser(tutor, (tx) =>
  tx`select count(*)::int as n from public.classes where tutor_id != ${tutor.id}`,
);
expect("tutor: cannot see classes taught by other tutors", tutorOtherClasses[0].n, 0);

// ---------- admin: sees everything ----------------------------------------

const adminProfileCount = await asUser(admin, (tx) =>
  tx`select count(*)::int as n from public.profiles`,
);
console.log(`  admin sees ${adminProfileCount[0].n} profiles (expect 20)`);
expect("admin: sees all profiles", adminProfileCount[0].n, 20);

const adminLessonNotes = await asUser(admin, (tx) =>
  tx`select count(*)::int as n from public.lesson_notes`,
);
console.log(`  admin sees ${adminLessonNotes[0].n} lesson_notes rows (informational)`);

// ---------- RLS enabled check ----------------------------------------------

const rlsTables = await sql`
  select c.relname, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname not like 'drizzle%'
  order by c.relname
`;
console.log("\nRLS enabled per table:");
let allEnabled = true;
for (const r of rlsTables) {
  console.log(`  ${r.relrowsecurity ? "✓" : "✗"} ${r.relname}`);
  if (!r.relrowsecurity) allEnabled = false;
}
expect("RLS enabled on all public tables", allEnabled, true);

await sql.end();
console.log("\nDone. Exit code:", process.exitCode ?? 0);
