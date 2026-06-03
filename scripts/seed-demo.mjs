// Idempotent demo seed for Taiyo Tuition. Populates every table so each
// role's dashboard shows realistic content. Safe to re-run.
//
// Run: node scripts/seed-demo.mjs

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;
if (!url || !serviceKey || !dbUrl) {
  console.error("Missing env vars in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(dbUrl, { prepare: false });

// ----------------------------------------------------------------------------
// 1. Auth users (tutors, students, parents) — keep existing @taiyo.com seeds.
// ----------------------------------------------------------------------------

const TUTORS = [
  { email: "tutor@taiyo.com", first: "Tom", last: "Tutor" },
  { email: "lee@taiyo.com", first: "Daniel", last: "Lee" },
  { email: "park@taiyo.com", first: "Hana", last: "Park" },
  { email: "chen@taiyo.com", first: "Wei", last: "Chen" },
  { email: "patel@taiyo.com", first: "Arjun", last: "Patel" },
];

const STUDENTS = [
  { email: "student@taiyo.com", first: "Sarah", last: "Nguyen", year: "Year 9", school: "Mount Waverley SC" },
  { email: "daniel.kim@taiyo.com", first: "Daniel", last: "Kim", year: "Year 10", school: "Glen Waverley SC" },
  { email: "chloe.zhang@taiyo.com", first: "Chloe", last: "Zhang", year: "VCE", school: "MacRobertson Girls HS" },
  { email: "lucas.tran@taiyo.com", first: "Lucas", last: "Tran", year: "VCE", school: "Melbourne HS" },
  { email: "ava.williams@taiyo.com", first: "Ava", last: "Williams", year: "Year 11", school: "Camberwell HS" },
  { email: "noah.singh@taiyo.com", first: "Noah", last: "Singh", year: "Year 9", school: "Glen Waverley SC" },
  { email: "mia.chen@taiyo.com", first: "Mia", last: "Chen", year: "Year 10", school: "Balwyn HS" },
  { email: "ethan.lee@taiyo.com", first: "Ethan", last: "Lee", year: "Year 11", school: "Mount Waverley SC" },
  { email: "isla.brown@taiyo.com", first: "Isla", last: "Brown", year: "VCE", school: "Methodist Ladies' College" },
  { email: "oscar.davis@taiyo.com", first: "Oscar", last: "Davis", year: "Year 10", school: "Scotch College" },
];

const PARENTS = [
  {
    email: "parent@taiyo.com",
    first: "Pat",
    last: "Nguyen",
    children: ["student@taiyo.com", "noah.singh@taiyo.com"],
  },
  {
    email: "kim@taiyo.com",
    first: "Jin",
    last: "Kim",
    children: ["daniel.kim@taiyo.com", "ethan.lee@taiyo.com"],
  },
  {
    email: "zhang@taiyo.com",
    first: "Wendy",
    last: "Zhang",
    children: ["chloe.zhang@taiyo.com", "mia.chen@taiyo.com"],
  },
  {
    email: "tran@taiyo.com",
    first: "Linh",
    last: "Tran",
    children: ["lucas.tran@taiyo.com"],
  },
  {
    email: "williams@taiyo.com",
    first: "Marcus",
    last: "Williams",
    children: ["ava.williams@taiyo.com"],
  },
  {
    email: "brown@taiyo.com",
    first: "Helen",
    last: "Brown",
    children: ["isla.brown@taiyo.com"],
  },
  {
    email: "davis@taiyo.com",
    first: "Tom",
    last: "Davis",
    children: ["oscar.davis@taiyo.com"],
  },
];

const DEFAULT_PASSWORD = "demo1234";

async function upsertAuthUser({ email, first, last, role, password = DEFAULT_PASSWORD }) {
  const list = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list.data?.users?.find((u) => u.email === email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      app_metadata: {
        ...existing.app_metadata,
        role,
        first_name: first,
        last_name: last,
      },
    });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role, first_name: first, last_name: last },
  });
  if (error) throw error;
  return data.user.id;
}

async function upsertProfile({ id, role, email, first, last, year = null, school = null }) {
  await sql`
    insert into profiles (id, role, email, first_name, last_name, year_level, school, is_active)
    values (${id}, ${role}, ${email}, ${first}, ${last}, ${year}, ${school}, true)
    on conflict (id) do update set
      role = excluded.role,
      email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      year_level = excluded.year_level,
      school = excluded.school,
      is_active = true
  `;
}

console.log("→ Creating tutor accounts");
const tutorIds = {};
for (const t of TUTORS) {
  const id = await upsertAuthUser({ ...t, role: "tutor" });
  await upsertProfile({ id, role: "tutor", email: t.email, first: t.first, last: t.last });
  tutorIds[t.email] = id;
}

console.log("→ Creating student accounts");
const studentIds = {};
for (const s of STUDENTS) {
  const id = await upsertAuthUser({ ...s, role: "student" });
  await upsertProfile({
    id,
    role: "student",
    email: s.email,
    first: s.first,
    last: s.last,
    year: s.year,
    school: s.school,
  });
  studentIds[s.email] = id;
}

console.log("→ Creating parent accounts + family links");
const parentIds = {};
for (const p of PARENTS) {
  const id = await upsertAuthUser({ ...p, role: "parent" });
  await upsertProfile({ id, role: "parent", email: p.email, first: p.first, last: p.last });
  parentIds[p.email] = id;
  for (const childEmail of p.children) {
    const childId = studentIds[childEmail];
    if (!childId) continue;
    await sql`
      insert into family_links (parent_id, student_id, relationship)
      values (${id}, ${childId}, 'parent')
      on conflict (parent_id, student_id) do nothing
    `;
  }
}

// Make sure admin@taiyo.com keeps its role
console.log("→ Ensuring admin profile present");
{
  const list = await admin.auth.admin.listUsers({ perPage: 200 });
  const a = list.data.users.find((u) => u.email === "admin@taiyo.com");
  if (a) {
    await upsertProfile({
      id: a.id,
      role: "admin",
      email: "admin@taiyo.com",
      first: "Admin",
      last: "Tayio",
    });
  }
}

// ----------------------------------------------------------------------------
// 2. Subjects
// ----------------------------------------------------------------------------

const SUBJECTS = [
  { name: "VCE Maths Methods", year: "VCE" },
  { name: "VCE Specialist Maths", year: "VCE" },
  { name: "VCE Physics", year: "VCE" },
  { name: "VCE Chemistry", year: "VCE" },
  { name: "VCE Biology", year: "VCE" },
  { name: "VCE English", year: "VCE" },
  { name: "Year 11 Methods", year: "Year 11" },
  { name: "Year 10 Maths", year: "Year 10" },
  { name: "Year 9 Maths", year: "Year 9" },
  { name: "Year 9 English", year: "Year 9" },
];

console.log("→ Upserting subjects");
const subjectIds = {};
for (const s of SUBJECTS) {
  const [row] = await sql`
    insert into subjects (id, name, year_level)
    values (${randomUUID()}, ${s.name}, ${s.year})
    on conflict (name) do update set year_level = excluded.year_level
    returning id
  `;
  subjectIds[s.name] = row.id;
}

// ----------------------------------------------------------------------------
// 2.5. Curriculum scaffold — one term covering the lesson window, plus
//      10 weekly placeholder subject_weeks per subject so the subject
//      weekly page renders real content instead of "Curriculum coming soon".
// ----------------------------------------------------------------------------

console.log("→ Upserting curriculum (term + subject weeks)");

const TERM_WEEKS = 10; // 10 weeks of curriculum per subject
const _termToday = new Date();
_termToday.setHours(0, 0, 0, 0);
const _termStart = new Date(_termToday);
_termStart.setDate(_termStart.getDate() - 21); // covers windowStart (today - 21d)
const _termEnd = new Date(_termStart);
_termEnd.setDate(_termEnd.getDate() + TERM_WEEKS * 7 - 1); // 10 weeks long

function isoDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const termYear = _termStart.getFullYear();
const termNumber = Math.ceil((_termStart.getMonth() + 1) / 3); // rough Q1-Q4 mapping

const [termRow] = await sql`
  insert into terms (id, year, term_number, start_date, end_date)
  values (${randomUUID()}, ${termYear}, ${termNumber},
    ${isoDateLocal(_termStart)}, ${isoDateLocal(_termEnd)})
  on conflict (year, term_number) do update set
    start_date = excluded.start_date,
    end_date = excluded.end_date
  returning id
`;
const termId = termRow.id;

// Each subject gets 10 weeks; weekN's title comes from TOPICS_BY_SUBJECT cycled.
const FALLBACK_TOPICS = ["the chapter", "review", "practice", "extension"];
const subjectWeekIds = {}; // { subjectName -> [weekNumber-1]: subjectWeekId }
for (const s of SUBJECTS) {
  const sid = subjectIds[s.name];
  subjectWeekIds[s.name] = [];
  // Topics per subject — reuse TOPICS_BY_SUBJECT if defined later, otherwise fallback.
  // (TOPICS_BY_SUBJECT is declared further down; we inline a small subset here.)
  const subjectTopics =
    {
      "Year 9 Maths": ["linear equations", "negative numbers", "fractions", "Pythagoras", "perimeter & area", "indices", "probability", "statistics", "review", "exam prep"],
      "Year 9 English": ["thesis structure", "Romeo and Juliet themes", "persuasive devices", "essay planning", "language analysis", "creative writing", "comparative texts", "vocabulary", "revision", "mock exam"],
      "Year 10 Maths": ["quadratics", "trigonometry", "indices", "statistics", "probability", "linear graphs", "simultaneous equations", "surds", "review", "exam prep"],
      "Year 11 Methods": ["functions", "calculus intro", "polynomials", "probability", "transformations", "exponentials", "logarithms", "derivatives", "review", "exam prep"],
      "VCE Maths Methods": ["differentiation", "integration", "binomial theorem", "logarithms", "trig functions", "probability", "applications", "exam Q1-3", "exam Q4-6", "full exam"],
      "VCE Specialist Maths": ["complex numbers", "vectors", "dynamics", "differential equations", "kinematics", "proofs", "polar coords", "exam Q1-3", "exam Q4-6", "full exam"],
      "VCE Physics": ["kinematics", "Newton's laws", "wave optics", "electromagnetism", "thermodynamics", "circuits", "fields", "exam Q1-3", "exam Q4-6", "full exam"],
      "VCE Chemistry": ["organic chemistry", "equilibria", "redox reactions", "stoichiometry", "acid-base", "thermochem", "kinetics", "exam Q1-3", "exam Q4-6", "full exam"],
      "VCE Biology": ["cell signalling", "DNA replication", "evolution", "homeostasis", "genetics", "ecology", "immunity", "exam Q1-3", "exam Q4-6", "full exam"],
      "VCE English": ["text analysis", "comparative essay", "language analysis", "creative writing", "argument analysis", "context", "revision", "mock 1", "mock 2", "exam prep"],
    }[s.name] ?? FALLBACK_TOPICS;

  for (let wk = 1; wk <= TERM_WEEKS; wk++) {
    const title = subjectTopics[(wk - 1) % subjectTopics.length];
    const description = `Week ${wk} · ${title}`;
    // Dedupe by (subject, term, weekNumber)
    const [existing] = await sql`
      select id from subject_weeks
      where subject_id = ${sid} and term_id = ${termId} and week_number = ${wk}
      limit 1
    `;
    let id;
    if (existing) {
      await sql`update subject_weeks set title = ${title}, description = ${description}, updated_at = now() where id = ${existing.id}`;
      id = existing.id;
    } else {
      const [row] = await sql`
        insert into subject_weeks (id, subject_id, term_id, week_number, title, description)
        values (${randomUUID()}, ${sid}, ${termId}, ${wk}, ${title}, ${description})
        returning id
      `;
      id = row.id;
    }
    subjectWeekIds[s.name].push(id);
  }
}

/** Map a date to its subject_week id for a given subject, based on weeks from term start. */
function weekIdForDate(subjectName, date) {
  const diffDays = Math.floor(
    (date.getTime() - _termStart.getTime()) / (1000 * 60 * 60 * 24),
  );
  const weekNum = Math.floor(diffDays / 7) + 1;
  if (weekNum < 1 || weekNum > TERM_WEEKS) return null;
  return subjectWeekIds[subjectName]?.[weekNum - 1] ?? null;
}

// ----------------------------------------------------------------------------
// 3. Classes
// ----------------------------------------------------------------------------

const CLASSES = [
  { name: "Year 9 Maths · Saturday AM", subject: "Year 9 Maths", tutor: "tutor@taiyo.com", weekday: 6, start: "10:00", end: "11:30", location: "Room 3" },
  { name: "Year 10 Maths · Monday PM", subject: "Year 10 Maths", tutor: "tutor@taiyo.com", weekday: 1, start: "16:00", end: "17:30", location: "Room 2" },
  { name: "Year 9 English · Tuesday PM", subject: "Year 9 English", tutor: "lee@taiyo.com", weekday: 2, start: "16:00", end: "17:30", location: "Room 1" },
  { name: "Year 10 Maths · Wednesday PM", subject: "Year 10 Maths", tutor: "park@taiyo.com", weekday: 3, start: "16:30", end: "18:00", location: "Room 2" },
  { name: "Year 11 Methods · Thursday PM", subject: "Year 11 Methods", tutor: "patel@taiyo.com", weekday: 4, start: "17:00", end: "18:30", location: "Room 4" },
  { name: "VCE Methods · Sunday AM", subject: "VCE Maths Methods", tutor: "tutor@taiyo.com", weekday: 0, start: "09:00", end: "10:30", location: "Room 3" },
  { name: "VCE Specialist · Sunday PM", subject: "VCE Specialist Maths", tutor: "park@taiyo.com", weekday: 0, start: "14:00", end: "15:30", location: "Room 3" },
  { name: "VCE Physics · Monday PM", subject: "VCE Physics", tutor: "chen@taiyo.com", weekday: 1, start: "17:00", end: "18:30", location: "Room 1" },
  { name: "VCE Chemistry · Thursday PM", subject: "VCE Chemistry", tutor: "chen@taiyo.com", weekday: 4, start: "18:30", end: "20:00", location: "Room 1" },
];

console.log("→ Upserting classes");
const classIds = {};
for (const c of CLASSES) {
  const [existing] = await sql`select id from classes where name = ${c.name} limit 1`;
  let id;
  if (existing) {
    await sql`
      update classes set
        subject_id = ${subjectIds[c.subject]},
        tutor_id = ${tutorIds[c.tutor]},
        weekday = ${c.weekday},
        start_time = ${c.start},
        end_time = ${c.end},
        location = ${c.location}
      where id = ${existing.id}
    `;
    id = existing.id;
  } else {
    const [row] = await sql`
      insert into classes (id, name, subject_id, tutor_id, capacity, location, is_recurring, weekday, start_time, end_time)
      values (
        ${randomUUID()},
        ${c.name},
        ${subjectIds[c.subject]},
        ${tutorIds[c.tutor]},
        8,
        ${c.location},
        true,
        ${c.weekday},
        ${c.start},
        ${c.end}
      )
      returning id
    `;
    id = row.id;
  }
  classIds[c.name] = id;
}

// ----------------------------------------------------------------------------
// 4. Enrollments — wire students into classes
// ----------------------------------------------------------------------------

const ENROLMENTS = {
  "Year 9 Maths · Saturday AM": ["student@taiyo.com", "noah.singh@taiyo.com"],
  "Year 10 Maths · Monday PM": ["daniel.kim@taiyo.com", "mia.chen@taiyo.com", "oscar.davis@taiyo.com"],
  "Year 9 English · Tuesday PM": ["student@taiyo.com", "noah.singh@taiyo.com"],
  "Year 10 Maths · Wednesday PM": ["daniel.kim@taiyo.com", "mia.chen@taiyo.com", "oscar.davis@taiyo.com"],
  "Year 11 Methods · Thursday PM": ["ava.williams@taiyo.com", "ethan.lee@taiyo.com"],
  "VCE Methods · Sunday AM": ["chloe.zhang@taiyo.com", "lucas.tran@taiyo.com", "isla.brown@taiyo.com"],
  "VCE Specialist · Sunday PM": ["chloe.zhang@taiyo.com", "lucas.tran@taiyo.com"],
  "VCE Physics · Monday PM": ["lucas.tran@taiyo.com", "isla.brown@taiyo.com"],
  "VCE Chemistry · Thursday PM": ["chloe.zhang@taiyo.com", "isla.brown@taiyo.com"],
};

console.log("→ Upserting enrolments");
for (const [className, emails] of Object.entries(ENROLMENTS)) {
  const cid = classIds[className];
  for (const email of emails) {
    const sid = studentIds[email];
    if (!sid) continue;
    await sql`
      insert into enrollments (class_id, student_id)
      values (${cid}, ${sid})
      on conflict (class_id, student_id) do update set withdrawn_at = null
    `;
  }
}

// ----------------------------------------------------------------------------
// 5. Lessons — generate 6 weeks (3 past, 3 future) per class
// ----------------------------------------------------------------------------

console.log("→ Generating lessons");

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function nextWeekdayOnOrAfter(from, weekday) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const delta = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const windowStart = new Date(today);
windowStart.setDate(windowStart.getDate() - 21);
const windowEnd = new Date(today);
windowEnd.setDate(windowEnd.getDate() + 21);

const allLessons = []; // { id, classId, tutorId, date, startTime, endTime, status, isPast, students }

for (const c of CLASSES) {
  const classId = classIds[c.name];
  const tutorId = tutorIds[c.tutor];
  const enrolledEmails = ENROLMENTS[c.name] ?? [];
  const enrolledIds = enrolledEmails.map((e) => studentIds[e]).filter(Boolean);

  let cursor = nextWeekdayOnOrAfter(windowStart, c.weekday);
  while (cursor <= windowEnd) {
    const dateStr = isoDate(cursor);
    const isPast = cursor < today;
    // Realistic status mix for past lessons; future lessons stay upcoming.
    let status;
    if (isPast) {
      const r = Math.random();
      status = r < 0.85 ? "completed" : r < 0.93 ? "cancelled" : "missed";
    } else {
      status = "upcoming";
    }

    // No unique constraint on (class_id, date, start_time) — check first.
    const [existing] = await sql`
      select id, status from lessons
      where class_id = ${classId} and date = ${dateStr} and start_time = ${c.start}
      limit 1
    `;
    let lessonId;
    let actualStatus;
    if (existing) {
      lessonId = existing.id;
      actualStatus = existing.status;
    } else {
      const [row] = await sql`
        insert into lessons (id, class_id, tutor_id, date, start_time, end_time, status, location)
        values (
          ${randomUUID()}, ${classId}, ${tutorId}, ${dateStr},
          ${c.start}, ${c.end}, ${status}, ${c.location}
        )
        returning id, status
      `;
      lessonId = row.id;
      actualStatus = row.status;
    }
    if (lessonId) {
      allLessons.push({
        id: lessonId,
        classId,
        tutorId,
        date: dateStr,
        startTime: c.start,
        endTime: c.end,
        status: actualStatus,
        isPast,
        students: enrolledIds,
        subjectName: c.subject,
      });
    }
    cursor.setDate(cursor.getDate() + 7);
  }
}

// ----------------------------------------------------------------------------
// 6. Attendance — fill in for completed lessons
// ----------------------------------------------------------------------------

console.log("→ Filling attendance");
for (const l of allLessons) {
  if (l.status !== "completed") continue;
  for (const sid of l.students) {
    const r = Math.random();
    const status = r < 0.85 ? "present" : r < 0.95 ? "late" : "absent";
    await sql`
      insert into attendance (lesson_id, student_id, status, marked_by)
      values (${l.id}, ${sid}, ${status}, ${l.tutorId})
      on conflict (lesson_id, student_id) do nothing
    `;
  }
}

// ----------------------------------------------------------------------------
// 6.5. Make-up lessons — pick up to 2 completed lessons, mark one student
//      absent on the original, then create a make-up lesson on a later date
//      with `makeup_attended` attendance. Demos the admin reschedule flow.
// ----------------------------------------------------------------------------

console.log("→ Seeding make-up lessons");
{
  const candidates = allLessons.filter(
    (l) => l.status === "completed" && l.students.length > 0,
  );
  // Shuffle and take 2
  candidates.sort(() => Math.random() - 0.5);
  const picks = candidates.slice(0, 2);

  for (const orig of picks) {
    const studentId = orig.students[0];
    // Flip the student's attendance on the original lesson to "absent"
    await sql`
      insert into attendance (lesson_id, student_id, status, note, marked_by)
      values (${orig.id}, ${studentId}, 'absent', 'Rescheduled to make-up', ${orig.tutorId})
      on conflict (lesson_id, student_id) do update set
        status = 'absent',
        note = excluded.note,
        marked_at = now()
    `;

    // Create a make-up lesson 3 days after the original at the same time.
    const makeupDate = new Date(`${orig.date}T00:00:00`);
    makeupDate.setDate(makeupDate.getDate() + 3);
    const makeupDateStr = isoDate(makeupDate);

    // Dedupe: skip if a makeup row already exists pointing back to this lesson
    const [existingMakeup] = await sql`
      select id from lessons where rescheduled_from = ${orig.id} limit 1
    `;
    let makeupId;
    if (existingMakeup) {
      makeupId = existingMakeup.id;
    } else {
      const [row] = await sql`
        insert into lessons (
          id, class_id, tutor_id, date, start_time, end_time,
          status, location, rescheduled_from
        )
        values (
          ${randomUUID()}, ${orig.classId}, ${orig.tutorId},
          ${makeupDateStr}, ${orig.startTime}, ${orig.endTime},
          'makeup', null, ${orig.id}
        )
        returning id
      `;
      makeupId = row.id;
    }

    await sql`
      insert into attendance (lesson_id, student_id, status, note, marked_by)
      values (${makeupId}, ${studentId}, 'makeup_attended', 'Make-up session', ${orig.tutorId})
      on conflict (lesson_id, student_id) do nothing
    `;
  }
}

// ----------------------------------------------------------------------------
// 7. Lesson notes — ~70% of completed lessons, per student
// ----------------------------------------------------------------------------

console.log("→ Writing lesson notes");

const PARENT_VISIBLE_TEMPLATES = [
  "Worked through {topic} today. Good engagement, especially when applying it to worked examples. Recommended {action} before next lesson.",
  "Covered {topic}. Confident on the basics, needs more practice with the trickier cases. Set a worksheet to consolidate.",
  "Today's focus was {topic}. Solid understanding overall — encouraged independent practice this week.",
  "Reviewed {topic} and the previous quiz. Identified the gap as careless errors more than concept; we worked on a check-back routine.",
];
const INTERNAL_TEMPLATES = [
  "Slightly distracted at the start, settled in after 15 min. Worth flagging if pattern continues.",
  "Confidence dipped when introduced to harder examples — keep encouragement up and don't pile on new content next week.",
  "Strong session. Could be ready to accelerate.",
  "Mentioned exam stress — keep an eye on workload, mention to parents only if it escalates.",
];
const TOPICS_BY_SUBJECT = {
  "Year 9 Maths": ["linear equations", "negative numbers", "fractions", "Pythagoras"],
  "Year 9 English": ["thesis structure", "Romeo and Juliet themes", "persuasive devices", "essay planning"],
  "Year 10 Maths": ["quadratics", "trigonometry", "indices", "statistics"],
  "Year 11 Methods": ["functions", "calculus introduction", "polynomials", "probability"],
  "VCE Maths Methods": ["differentiation", "integration", "binomial theorem", "logarithms"],
  "VCE Specialist Maths": ["complex numbers", "vectors", "dynamics", "differential equations"],
  "VCE Physics": ["kinematics", "Newton's laws", "wave optics", "electromagnetism"],
  "VCE Chemistry": ["organic chemistry", "equilibria", "redox reactions", "stoichiometry"],
  "VCE Biology": ["cell signalling", "DNA replication", "evolution", "homeostasis"],
  "VCE English": ["text analysis", "comparative essay", "language analysis", "creative writing"],
};
const ACTIONS = ["complete worksheet 3", "review quiz 2", "watch the supplementary video", "practise 5 questions a day"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function fill(template, topic) {
  return template.replace("{topic}", topic).replace("{action}", pick(ACTIONS));
}

for (const l of allLessons) {
  if (l.status !== "completed") continue;
  const topic = pick(TOPICS_BY_SUBJECT[l.subjectName] ?? ["the chapter"]);
  for (const sid of l.students) {
    // Dedupe by (lesson_id, student_id) — at most one note per pair.
    const [existing] = await sql`
      select id from lesson_notes where lesson_id = ${l.id} and student_id = ${sid} limit 1
    `;
    if (existing) continue;
    const parentVisible = fill(pick(PARENT_VISIBLE_TEMPLATES), topic);
    const internal = pick(INTERNAL_TEMPLATES);
    await sql`
      insert into lesson_notes (
        id, lesson_id, student_id, tutor_id,
        topic_covered, parent_visible_comment, internal_note
      )
      values (
        ${randomUUID()}, ${l.id}, ${sid}, ${l.tutorId},
        ${topic}, ${parentVisible}, ${internal}
      )
    `;
  }
}

// ----------------------------------------------------------------------------
// 8. Homework — one per subject_week so every week on the curriculum page
//    has a homework attached. Titles match the week topic. Due date is the
//    end of the week (week start + 6 days), so past weeks land overdue/marked
//    and future weeks land as viewed/not_started.
// ----------------------------------------------------------------------------

console.log("→ Creating homework");

// One entry per subject_week (10 weeks per subject). Index = week number - 1.
// The week titles here MUST match the titles in subjectTopics above so that
// the curriculum page (student) and the homework list (tutor/parent/admin)
// reference the same concept by name. weekNumber drives the due_date.
const HOMEWORK_BY_SUBJECT = {
  "Year 9 Maths": [
    { title: "Linear equations worksheet",   desc: "10 mixed linear-equation problems." },
    { title: "Negative numbers practice",    desc: "Operations with negatives, 15 questions." },
    { title: "Fractions mixed practice",     desc: "Add/sub/mul/div fractions worksheet." },
    { title: "Pythagoras problem set",       desc: "Real-world Pythagoras questions." },
    { title: "Perimeter & area worksheet",   desc: "Composite shapes calculations." },
    { title: "Indices practice",             desc: "Index laws — 12 questions." },
    { title: "Probability basics",           desc: "Sample space + simple probability." },
    { title: "Statistics summary set",       desc: "Mean / median / mode / range." },
    { title: "End-of-term review sheet",     desc: "Mixed review covering term content." },
    { title: "Mock exam paper",              desc: "Full 60-min practice paper." },
  ],
  "Year 9 English": [
    { title: "Thesis structure paragraph",   desc: "Write one paragraph using TEEL." },
    { title: "Romeo & Juliet themes notes",  desc: "Read Act 2, write 3 discussion qs." },
    { title: "Persuasive devices worksheet", desc: "Identify rhetorical techniques in given article." },
    { title: "Essay planning task",          desc: "Plan a 3-body essay on the prompt." },
    { title: "Text analysis quotes table",   desc: "Collect 10 quotes + analyse each." },
    { title: "Creative writing draft",       desc: "600-word short story draft." },
    { title: "Comparative texts notes",      desc: "Compare two prescribed extracts." },
    { title: "Vocabulary set",               desc: "20-word list — definitions + sentences." },
    { title: "Revision summary sheet",       desc: "One-page summary of term." },
    { title: "Mock exam essay",              desc: "Full timed essay under exam conditions." },
  ],
  "Year 10 Maths": [
    { title: "Quadratics quiz",              desc: "Online quiz, 30 minutes." },
    { title: "Trigonometry worksheet",       desc: "Mixed angle problems." },
    { title: "Indices practice set",         desc: "Index laws application questions." },
    { title: "Statistics worksheet",         desc: "Box plots + stem-leaf." },
    { title: "Probability problems",         desc: "Tree diagrams + Venn diagrams." },
    { title: "Linear graphs practice",       desc: "Sketch + interpret 8 graphs." },
    { title: "Simultaneous equations set",   desc: "Elimination + substitution methods." },
    { title: "Surds worksheet",              desc: "Simplify + rationalise denominators." },
    { title: "Review consolidation sheet",   desc: "Mixed problems from the term." },
    { title: "Mock exam paper",              desc: "Full practice paper, 60 minutes." },
  ],
  "Year 11 Methods": [
    { title: "Functions revision worksheet", desc: "Linear, quadratic, cubic functions." },
    { title: "Calculus intro problems",      desc: "Differentiation basics, 12 questions." },
    { title: "Polynomials worksheet",        desc: "Factoring + roots of polynomials." },
    { title: "Probability set",              desc: "Conditional + tree diagrams." },
    { title: "Transformations worksheet",    desc: "Translate/dilate/reflect graphs." },
    { title: "Exponentials problems",        desc: "Solving exponential equations." },
    { title: "Logarithms worksheet",         desc: "Log laws + log equations." },
    { title: "Derivatives practice",         desc: "Power, product, quotient rules." },
    { title: "Review consolidation",         desc: "Mixed problems from the term." },
    { title: "Mock exam Q1-3",               desc: "Sit exam questions under time." },
  ],
  "VCE Maths Methods": [
    { title: "Differentiation set 1",        desc: "Application questions." },
    { title: "Integration set 1",            desc: "Definite + indefinite integrals." },
    { title: "Binomial theorem practice",    desc: "Expansion + specific term qs." },
    { title: "Logarithms worksheet",         desc: "Log laws + log equations." },
    { title: "Trig functions problems",      desc: "Solve trig equations in a range." },
    { title: "Probability problems",         desc: "Binomial + normal distribution." },
    { title: "Applications problem set",     desc: "Real-world modelling problems." },
    { title: "Past paper Q1-3",              desc: "From 2022 exam 1, sections A." },
    { title: "Past paper Q4-6",              desc: "From 2022 exam 1, sections B." },
    { title: "Full mock exam",               desc: "Sit full exam under time." },
  ],
  "VCE Specialist Maths": [
    { title: "Complex numbers practice",     desc: "Polar form conversions." },
    { title: "Vectors worksheet",            desc: "3D vector problems." },
    { title: "Dynamics problem set",         desc: "Forces + circular motion." },
    { title: "Differential equations set",   desc: "First-order ODEs." },
    { title: "Kinematics problems",          desc: "Projectile + relative motion." },
    { title: "Proofs worksheet",             desc: "Induction + contradiction." },
    { title: "Polar coordinates set",        desc: "Convert + sketch polar graphs." },
    { title: "Past paper Q1-3",              desc: "Exam 1 short-answer." },
    { title: "Past paper Q4-6",              desc: "Exam 2 multi-step." },
    { title: "Full mock exam",               desc: "Sit full exam under time." },
  ],
  "VCE Physics": [
    { title: "Kinematics problems",          desc: "10 questions including projectile motion." },
    { title: "Newton's laws worksheet",      desc: "Free-body diagrams + net force." },
    { title: "Wave optics problems",         desc: "Diffraction + interference." },
    { title: "Electromagnetism set",         desc: "Magnetic flux + Faraday's law." },
    { title: "Thermodynamics worksheet",     desc: "First law + heat engines." },
    { title: "Circuits problems",            desc: "Series/parallel + Kirchhoff's laws." },
    { title: "Fields worksheet",             desc: "Gravitational + electric fields." },
    { title: "Past paper Q1-3",              desc: "Exam 1 short-answer." },
    { title: "Past paper Q4-6",              desc: "Exam 2 application questions." },
    { title: "Full mock exam",               desc: "Sit full exam under time." },
  ],
  "VCE Chemistry": [
    { title: "Organic reactions chart",      desc: "Complete the reaction map." },
    { title: "Equilibria problems",          desc: "Le Chatelier questions." },
    { title: "Redox reactions worksheet",    desc: "Half-equations + oxidation states." },
    { title: "Stoichiometry set",            desc: "Mole calculations + limiting reagent." },
    { title: "Acid-base titration problems", desc: "pH + titration curves." },
    { title: "Thermochemistry worksheet",    desc: "Enthalpy + Hess's law." },
    { title: "Kinetics problems",            desc: "Rate laws + Arrhenius equation." },
    { title: "Past paper Q1-3",              desc: "Exam 1 short-answer." },
    { title: "Past paper Q4-6",              desc: "Exam 2 application questions." },
    { title: "Full mock exam",               desc: "Sit full exam under time." },
  ],
  "VCE Biology": [
    { title: "Cell signalling worksheet",    desc: "Signal transduction pathways." },
    { title: "DNA replication notes",        desc: "Step-by-step diagram + 5 qs." },
    { title: "Evolution problem set",        desc: "Natural selection scenarios." },
    { title: "Homeostasis worksheet",        desc: "Negative feedback loops." },
    { title: "Genetics problems",            desc: "Punnett squares + pedigrees." },
    { title: "Ecology field exercise",       desc: "Food web + energy flow analysis." },
    { title: "Immunity worksheet",           desc: "Innate vs adaptive responses." },
    { title: "Past paper Q1-3",              desc: "Exam 1 short-answer." },
    { title: "Past paper Q4-6",              desc: "Exam 2 application questions." },
    { title: "Full mock exam",               desc: "Sit full exam under time." },
  ],
  "VCE English": [
    { title: "Text analysis quotes table",   desc: "Collect 10 quotes + analyse each." },
    { title: "Comparative essay draft",      desc: "800-word comparative draft." },
    { title: "Language analysis exercise",   desc: "Annotate a persuasive article." },
    { title: "Creative writing piece",       desc: "Reflective short piece, 600 words." },
    { title: "Argument analysis task",       desc: "Identify + evaluate three arguments." },
    { title: "Context essay plan",           desc: "Plan a context-based essay." },
    { title: "Revision summary",             desc: "One-page summary of texts studied." },
    { title: "Mock essay 1",                 desc: "Timed essay, exam conditions." },
    { title: "Mock essay 2",                 desc: "Timed comparative essay." },
    { title: "Full mock exam",               desc: "Sit full exam under time." },
  ],
};

for (const c of CLASSES) {
  const items = HOMEWORK_BY_SUBJECT[c.subject] ?? [];
  const classId = classIds[c.name];
  const tutorId = tutorIds[c.tutor];
  const enrolledIds = (ENROLMENTS[c.name] ?? []).map((e) => studentIds[e]).filter(Boolean);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Index i is 0-based; weekNumber is i+1. Due date = end of that week
    // (term start + (weekNumber-1) * 7 + 6 days). This guarantees each
    // subject_week has exactly one homework tied to it via week_id.
    const weekNumber = i + 1;
    const due = new Date(_termStart);
    due.setDate(due.getDate() + (weekNumber - 1) * 7 + 6);
    // offsetDays vs today drives assignment status branching below
    const offsetDays = Math.floor(
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Map due date to a subject_week so the homework shows up on the
    // weekly subject page in the right week.
    const weekId = weekIdForDate(c.subject, due);

    // Idempotent: dedupe by (class_id, title) — schema has no unique index so check first.
    const [existing] = await sql`
      select id from homework where class_id = ${classId} and title = ${item.title} limit 1
    `;
    let homeworkId;
    if (existing) {
      // Backfill week_id if it was previously null
      if (weekId) {
        await sql`update homework set week_id = ${weekId} where id = ${existing.id} and week_id is null`;
      }
      homeworkId = existing.id;
    } else {
      const [row] = await sql`
        insert into homework (id, class_id, tutor_id, week_id, title, description, due_date)
        values (${randomUUID()}, ${classId}, ${tutorId}, ${weekId}, ${item.title}, ${item.desc}, ${due.toISOString()})
        returning id
      `;
      homeworkId = row.id;
    }

    // Assignments per student with varied statuses
    for (const sid of enrolledIds) {
      const r = Math.random();
      let status, submittedAt, score, feedback, markedAt;
      if (offsetDays < 0) {
        // past-due
        if (r < 0.4) {
          status = "marked";
          submittedAt = new Date(due.getTime() - 2 * 86400000);
          score = (60 + Math.floor(Math.random() * 35)).toString();
          feedback = "Good attempt. Watch the working in Q2.";
          markedAt = new Date(due.getTime() + 86400000);
        } else if (r < 0.7) {
          status = "submitted";
          submittedAt = new Date(due.getTime() - 86400000);
        } else if (r < 0.9) {
          status = "late";
          submittedAt = new Date(due.getTime() + 86400000);
        } else {
          status = "not_started";
        }
      } else {
        // future-due
        if (r < 0.3) status = "viewed";
        else status = "not_started";
      }

      await sql`
        insert into homework_assignments (
          homework_id, student_id, status, submitted_at, score, feedback, marked_at, marked_by
        )
        values (
          ${homeworkId}, ${sid}, ${status},
          ${submittedAt ?? null},
          ${score ?? null},
          ${feedback ?? null},
          ${markedAt ?? null},
          ${markedAt ? tutorId : null}
        )
        on conflict (homework_id, student_id) do update set
          status = excluded.status,
          submitted_at = coalesce(excluded.submitted_at, homework_assignments.submitted_at),
          score = coalesce(excluded.score, homework_assignments.score),
          feedback = coalesce(excluded.feedback, homework_assignments.feedback),
          marked_at = coalesce(excluded.marked_at, homework_assignments.marked_at)
      `;
    }
  }
}

// ----------------------------------------------------------------------------
// 9. Progress topics — sprinkle mastery per student
// ----------------------------------------------------------------------------

console.log("→ Adding progress topics");
const MASTERY_BY_SUBJECT = TOPICS_BY_SUBJECT;
const masteryLevels = ["not_started", "needs_work", "improving", "strong"];

// For each enrolled (student, class) pair, write topics for the class's subject
for (const c of CLASSES) {
  const subj = c.subject;
  const sid = subjectIds[subj];
  const topics = MASTERY_BY_SUBJECT[subj] ?? [];
  const students = (ENROLMENTS[c.name] ?? []).map((e) => studentIds[e]).filter(Boolean);
  for (const studentId of students) {
    for (const topic of topics) {
      const mastery = pick(masteryLevels);
      // Idempotent on (student, subject, topic)
      const [existing] = await sql`
        select id from progress_topics
        where student_id = ${studentId} and subject_id = ${sid} and topic = ${topic}
        limit 1
      `;
      if (existing) {
        await sql`
          update progress_topics set mastery = ${mastery}, updated_by = ${tutorIds[c.tutor]}, updated_at = now()
          where id = ${existing.id}
        `;
      } else {
        await sql`
          insert into progress_topics (id, student_id, subject_id, topic, mastery, updated_by)
          values (${randomUUID()}, ${studentId}, ${sid}, ${topic}, ${mastery}, ${tutorIds[c.tutor]})
        `;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 10. Invoices — for each parent, 2-3 across last 3 months
// ----------------------------------------------------------------------------

console.log("→ Creating invoices");
function monthsAgo(n) {
  const d = new Date(today);
  d.setMonth(d.getMonth() - n);
  return d;
}
for (const p of PARENTS) {
  const pid = parentIds[p.email];
  const firstChildId = studentIds[p.children[0]];
  const invoices = [
    { issuedAgo: 2, status: "paid", amount: "320.00" },
    { issuedAgo: 1, status: "paid", amount: "320.00" },
    { issuedAgo: 0, status: "unpaid", amount: "320.00" },
  ];
  for (const inv of invoices) {
    const issued = monthsAgo(inv.issuedAgo);
    const due = new Date(issued);
    due.setDate(due.getDate() + 14);
    const overdue = inv.status === "unpaid" && due < today;
    const status = overdue ? "overdue" : inv.status;
    const description = `Tutoring · ${issued.toLocaleString("en-AU", { month: "long", year: "numeric" })}`;

    // Dedupe by (parent, description)
    const [existing] = await sql`
      select id from invoices where parent_id = ${pid} and description = ${description} limit 1
    `;
    if (existing) {
      await sql`update invoices set status = ${status} where id = ${existing.id}`;
    } else {
      await sql`
        insert into invoices (
          id, parent_id, student_id, amount, currency, status,
          issued_at, due_date, paid_at, description
        )
        values (
          ${randomUUID()}, ${pid}, ${firstChildId}, ${inv.amount}, 'AUD', ${status},
          ${issued.toISOString()},
          ${isoDate(due)},
          ${status === "paid" ? new Date(due.getTime() - 86400000).toISOString() : null},
          ${description}
        )
      `;
    }
  }
}

// ----------------------------------------------------------------------------
// 11. Announcements
// ----------------------------------------------------------------------------

console.log("→ Posting announcements");
const adminUser = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users.find(
  (u) => u.email === "admin@taiyo.com",
);
const adminId = adminUser?.id;

if (adminId) {
  const ANNOUNCEMENTS = [
    {
      title: "Term 2 holiday program",
      body: "Intensive VCE revision week starts 24 June. Sign up via the front desk.",
      audienceRole: null,
    },
    {
      title: "Year 9 Maths — Saturday class room change",
      body: "From this Saturday, Year 9 Maths moves to Room 4. Same time, same tutor.",
      audienceRole: "student",
    },
    {
      title: "Reminder: invoices due 7 days after issue",
      body: "Please check your portal for any outstanding invoices.",
      audienceRole: "parent",
    },
    {
      title: "Tutor PD day — 30 June",
      body: "Optional professional development on differentiated instruction. Lunch provided.",
      audienceRole: "tutor",
    },
  ];

  for (const a of ANNOUNCEMENTS) {
    const [existing] = await sql`
      select id from announcements where title = ${a.title} limit 1
    `;
    if (existing) continue;
    await sql`
      insert into announcements (id, author_id, title, body, audience_role, published_at)
      values (${randomUUID()}, ${adminId}, ${a.title}, ${a.body}, ${a.audienceRole}, now())
    `;
  }
}

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------

console.log("\n→ Summary:");
for (const t of [
  "profiles",
  "family_links",
  "subjects",
  "terms",
  "subject_weeks",
  "classes",
  "enrollments",
  "lessons",
  "lesson_notes",
  "attendance",
  "homework",
  "homework_assignments",
  "progress_topics",
  "invoices",
  "announcements",
]) {
  const [{ count }] = await sql`select count(*)::int as count from ${sql(t)}`;
  console.log(`  ${t.padEnd(22)} ${count}`);
}

await sql.end();
console.log("\nDone.");
process.exit(0);
