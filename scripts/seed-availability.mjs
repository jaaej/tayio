import postgres from "postgres";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const candidates = [
  { weekday: 1, startTime: "16:00", endTime: "17:00" },
  { weekday: 2, startTime: "17:00", endTime: "18:00" },
  { weekday: 3, startTime: "16:00", endTime: "17:00" },
  { weekday: 3, startTime: "17:00", endTime: "18:00" },
  { weekday: 4, startTime: "17:00", endTime: "18:00" },
  { weekday: 5, startTime: "16:00", endTime: "17:00" },
  { weekday: 6, startTime: "09:00", endTime: "10:00" },
  { weekday: 6, startTime: "10:00", endTime: "11:00" },
  { weekday: 6, startTime: "14:00", endTime: "15:00" },
  { weekday: 0, startTime: "10:00", endTime: "11:00" },
];

async function main() {
  const tutors = await sql`SELECT id, first_name FROM profiles WHERE role = 'tutor'`;
  console.log("Found", tutors.length, "tutor(s)");

  for (const t of tutors) {
    const h = simpleHash(t.id);
    const picked = [];
    for (let i = 0; i < 5; i++) {
      const idx = (h + i * 17) % candidates.length;
      const slot = candidates[idx];
      if (
        !picked.some(
          (p) => p.weekday === slot.weekday && p.startTime === slot.startTime,
        )
      ) {
        picked.push(slot);
      }
    }
    await sql`DELETE FROM tutor_availability WHERE tutor_id = ${t.id} AND weekday IS NOT NULL`;
    for (const s of picked) {
      await sql`
        INSERT INTO tutor_availability (tutor_id, weekday, start_time, end_time, is_available)
        VALUES (${t.id}, ${s.weekday}, ${s.startTime}, ${s.endTime}, true)
      `;
    }
    console.log(" ", t.first_name, "→", picked.length, "slots");
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
