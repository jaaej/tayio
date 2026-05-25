// One-off: insert a single overdue invoice so the admin dashboard's
// "Needs your attention" section has something to render.
//
// Remove with:
//   psql "$DATABASE_URL" -c "delete from invoices where description like '[demo]%'"

import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const [parent] = await sql`
  select id from profiles where role = 'parent' order by created_at limit 1
`;
if (!parent) {
  console.error("No parent profile found. Run seed-demo first.");
  process.exit(1);
}

const [student] = await sql`
  select s.id from profiles s
  join family_links fl on fl.student_id = s.id
  where fl.parent_id = ${parent.id}
  limit 1
`;

const description = "[demo] Overdue tutoring · February 2026";
const dueDate = "2026-03-10"; // ~75 days before today (2026-05-25)

const [existing] = await sql`
  select id from invoices where description = ${description} limit 1
`;
if (existing) {
  console.log("Demo overdue invoice already exists:", existing.id);
} else {
  const id = randomUUID();
  const issued = new Date("2026-02-24T00:00:00Z").toISOString();
  await sql`
    insert into invoices (id, parent_id, student_id, amount, currency, status,
                          issued_at, due_date, description)
    values (${id}, ${parent.id}, ${student?.id ?? null}, '320.00', 'AUD', 'overdue',
            ${issued}, ${dueDate}, ${description})
  `;
  console.log("Inserted demo overdue invoice:", id);
}

await sql.end();
