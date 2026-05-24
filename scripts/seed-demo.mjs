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
];

const DEFAULT_PASSWORD = "demo1234";

async function upsertAuthUser({ email, first, last, role, password = DEFAULT_PASSWORD }) {
  const list = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list.data?.users?.find((u) => u.email === email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: {
        ...existing.user_metadata,
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
    user_metadata: { role, first_name: first, last_name: last },
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
// 3. Classes
// ----------------------------------------------------------------------------

const CLASSES = [
  { name: "Year 9 Maths · Saturday AM", subject: "Year 9 Maths", tutor: "tutor@taiyo.com", weekday: 6, start: "10:00", end: "11:30", location: "Room 3" },
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
// 8. Homework — 2 per class, with assignments for each enrolled student
// ----------------------------------------------------------------------------

console.log("→ Creating homework");

const HOMEWORK_BY_SUBJECT = {
  "Year 9 Maths": [
    { title: "Algebra Worksheet 3", desc: "Linear equations practice." },
    { title: "Pythagoras Problem Set", desc: "Real-world Pythagoras questions." },
  ],
  "Year 9 English": [
    { title: "Thesis paragraph", desc: "Write one paragraph on the prescribed prompt." },
    { title: "Romeo and Juliet reading", desc: "Read Act 2, write 3 discussion questions." },
  ],
  "Year 10 Maths": [
    { title: "Quadratics quiz", desc: "Online quiz, 30 minutes." },
    { title: "Trig worksheet", desc: "Mixed angle problems." },
  ],
  "Year 11 Methods": [
    { title: "Functions revision", desc: "Worksheet covering linear, quadratic, cubic functions." },
    { title: "Calculus intro", desc: "Differentiation basics, 12 questions." },
  ],
  "VCE Maths Methods": [
    { title: "Differentiation set 1", desc: "Application questions." },
    { title: "Past paper Q1-4", desc: "From 2022 exam 1." },
  ],
  "VCE Specialist Maths": [
    { title: "Complex numbers practice", desc: "Polar form conversions." },
    { title: "Vectors worksheet", desc: "3D vector problems." },
  ],
  "VCE Physics": [
    { title: "Kinematics problems", desc: "10 questions including projectile motion." },
    { title: "Lab report", desc: "Write up the inclined plane experiment." },
  ],
  "VCE Chemistry": [
    { title: "Organic reactions chart", desc: "Complete the reaction map." },
    { title: "Equilibria problems", desc: "Le Chatelier questions." },
  ],
};

for (const c of CLASSES) {
  const items = HOMEWORK_BY_SUBJECT[c.subject] ?? [];
  const classId = classIds[c.name];
  const tutorId = tutorIds[c.tutor];
  const enrolledIds = (ENROLMENTS[c.name] ?? []).map((e) => studentIds[e]).filter(Boolean);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Stagger due dates: first item due 3 days ago (some late), second due in 4 days
    const offsetDays = i === 0 ? -3 : 4;
    const due = new Date(today);
    due.setDate(due.getDate() + offsetDays);
    const titleKey = `${c.name}::${item.title}`;

    // Idempotent: dedupe by (class_id, title) — schema has no unique index so check first.
    const [existing] = await sql`
      select id from homework where class_id = ${classId} and title = ${item.title} limit 1
    `;
    let homeworkId;
    if (existing) {
      homeworkId = existing.id;
    } else {
      const [row] = await sql`
        insert into homework (id, class_id, tutor_id, title, description, due_date)
        values (${randomUUID()}, ${classId}, ${tutorId}, ${item.title}, ${item.desc}, ${due.toISOString()})
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
