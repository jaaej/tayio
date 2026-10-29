// Tutor demo seed: gives tom@taiyo.com a complete, believable week on the
// DEV database, laid out around the day it runs, so every tutor page has
// something to show and every demo action has something to act on.
//
//   node scripts/tutor-demo/seed.mjs          wipe the demo data, rebuild it for today
//   node scripts/tutor-demo/seed.mjs --wipe   wipe the demo data only
//
// Re-running is the reset: anything done during a rehearsal (marking,
// attendance, notes, replies) is wiped and rebuilt. Only accounts tagged
// with DEMO_TAG, the demo subjects and rows belonging to them are touched.
// Every run also resets the demo passwords, which signs those accounts out.
//
// The runthrough that goes with this data: docs/demo/tutor-demo.md

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import {
  COLLEAGUE,
  DEMO_TAG,
  FEEDBACK_BY_PERSONA,
  NOTE_BY_PERSONA,
  OTHERS_PASSWORD,
  STUDENTS,
  SUBJECTS,
  TUTOR,
  Y8_ANSWERS,
  Y8_TEXT_ANSWER,
  Y9_ESSAYS,
  demoEmail,
  weekDescription,
  weekObjectives,
} from "./content.mjs";
import {
  essayPlanner,
  factorTheoremAnswers,
  formulaSheet,
  linearAnswers,
  linearSolutions,
  linearWorksheet,
  weekBooklet,
} from "./pdfs.mjs";
import {
  addDays,
  formatTimeRange,
  melbourneInstant,
  melbourneToday,
  minutesBetween,
  mondayOf,
  weekNumberOn,
  weekdayName,
  weekdayOf,
} from "./time.mjs";

// ----------------------------------------------------------------------------
// Environment: the database the local dev server uses, and never Production.
// ----------------------------------------------------------------------------

loadEnv({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;
if (!url || !serviceKey || !dbUrl) {
  console.error("Missing Supabase or database settings in .env.local.");
  process.exit(1);
}
if (existsSync(".env.local.prod")) {
  const prodUrl = /^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m.exec(readFileSync(".env.local.prod", "utf8"))?.[1]?.trim();
  if (prodUrl && prodUrl === url) {
    console.error("Refusing to run: .env.local points at the Production project.");
    process.exit(1);
  }
}

const WIPE_ONLY = process.argv.includes("--wipe");
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(dbUrl, { prepare: false, onnotice: () => {} });

const BUCKETS = {
  submissions: "homework-submissions",
  attachments: "homework-attachments",
  curriculum: "curriculum",
  resources: "resource-library",
  profilePhotos: "profile-photos",
};

const now = new Date();
const today = melbourneToday(now);
const at = (isoDate, hhmm) => melbourneInstant(isoDate, hhmm);

function step(label) {
  console.log(`→ ${label}`);
}

// ----------------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------------

async function allAuthUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

const isDemo = (u) => u?.app_metadata?.demo === DEMO_TAG;

/**
 * Create or refresh a demo account the way the admin app creates accounts
 * (names in app_metadata only), and reset its password so a rehearsal that
 * changed it cannot lock the presenter out.
 */
async function upsertDemoUser(byEmail, { email, password, role, first, last }) {
  const app_metadata = { role, first_name: first, last_name: last, demo: DEMO_TAG };
  const existing = byEmail.get(email);
  let id;
  if (existing) {
    if (!isDemo(existing)) {
      throw new Error(`${email} already exists and is not a demo account. Not touching it.`);
    }
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata,
    });
    if (error) throw error;
    id = existing.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata,
    });
    if (error) throw new Error(`${email}: ${error.message}`);
    id = data.user.id;
  }
  return id;
}

async function upsertProfile({ id, role, email, first, last, year = null, school = null }) {
  // The 0001 trigger made the row with the auth user; set the full record.
  await sql`
    insert into profiles (id, role, email, first_name, last_name, year_level, school, is_active)
    values (${id}, ${role}, ${email}, ${first}, ${last}, ${year}, ${school}, true)
    on conflict (id) do update set
      role = excluded.role, email = excluded.email,
      first_name = excluded.first_name, last_name = excluded.last_name,
      year_level = excluded.year_level, school = excluded.school,
      is_active = true, pause_status = 'none',
      phone = null, bio = null, admin_notes = null,
      updated_at = now()
  `;
}

step("Checking accounts");
const byEmail = new Map((await allAuthUsers()).map((u) => [u.email?.toLowerCase(), u]));

const adminUser = byEmail.get("admin@taiyo.com");
if (!adminUser) throw new Error("admin@taiyo.com is missing from dev; the demo needs it as the office.");
const adminId = adminUser.id;

const people = {}; // key -> { id, first, last, email }
async function person(key, spec) {
  const id = await upsertDemoUser(byEmail, spec);
  await upsertProfile({ id, ...spec });
  people[key] = { id, ...spec };
  return id;
}

await person("tom", { ...TUTOR, role: "tutor" });
await person("maya", { ...COLLEAGUE, password: OTHERS_PASSWORD, role: "tutor" });
for (const s of STUDENTS) {
  await person(s.key, {
    email: demoEmail(s.first, s.last),
    password: OTHERS_PASSWORD,
    role: "student_restricted",
    first: s.first,
    last: s.last,
    year: s.year,
    school: s.school,
  });
  if (s.parent) {
    await person(`${s.key}Parent`, {
      email: demoEmail(s.parent.first, s.parent.last),
      password: OTHERS_PASSWORD,
      role: "parent",
      first: s.parent.first,
      last: s.parent.last,
    });
  }
}

const tomId = people.tom.id;
const mayaId = people.maya.id;
const tutorIds = [tomId, mayaId];
const studentIds = STUDENTS.map((s) => people[s.key].id);
const demoUserIds = Object.values(people).map((p) => p.id);
const demoEmails = Object.values(people).map((p) => p.email);
const subjectNames = Object.values(SUBJECTS).map((s) => s.name);

// ----------------------------------------------------------------------------
// Wipe: every row that belongs to the demo, in foreign-key order.
// ----------------------------------------------------------------------------

async function listTree(bucket, prefix) {
  const files = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) return files;
  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) files.push(...(await listTree(bucket, path)));
    else files.push(path);
  }
  return files;
}

async function removeObjects(bucket, paths) {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) console.warn(`  could not remove files from ${bucket}: ${error.message}`);
  }
}

async function wipe() {
  step("Wiping previous demo data");
  const subjects = await sql`select id from subjects where name = any(${subjectNames})`;
  const subjectIds = subjects.map((s) => s.id);

  // Never delete a real class: a demo tutor may only teach demo subjects,
  // and a demo subject may only be taught by demo tutors.
  const strays = await sql`
    select c.id, c.name from classes c
    where (c.tutor_id = any(${tutorIds}) and not (c.subject_id = any(${subjectIds})))
       or (c.subject_id = any(${subjectIds}) and not (c.tutor_id = any(${tutorIds})))
  `;
  if (strays.length > 0) {
    throw new Error(
      `A non-demo class is mixed into the demo (${strays.map((c) => c.name).join(", ")}). Reassign it before re-running.`,
    );
  }
  const classIds = (await sql`select id from classes where subject_id = any(${subjectIds})`).map((c) => c.id);
  const lessonIds = (await sql`select id from lessons where class_id = any(${classIds})`).map((l) => l.id);
  const homeworkIds = (await sql`
    select id from homework where class_id = any(${classIds}) or tutor_id = any(${tutorIds}) or created_by_id = any(${tutorIds})
  `).map((h) => h.id);
  const quizIds = (await sql`select id from quizzes where subject_id = any(${subjectIds})`).map((q) => q.id);
  const weekIds = (await sql`select id from subject_weeks where subject_id = any(${subjectIds})`).map((w) => w.id);
  const leaveIds = (await sql`select id from tutor_leave_requests where tutor_id = any(${tutorIds})`).map((l) => l.id);

  // Storage first, while the rows that name the files still exist.
  for (const id of studentIds) {
    await removeObjects(BUCKETS.submissions, await listTree(BUCKETS.submissions, id));
  }
  for (const id of tutorIds) {
    await removeObjects(BUCKETS.attachments, await listTree(BUCKETS.attachments, id));
  }
  await removeObjects(BUCKETS.curriculum, weekIds.map((id) => `booklets/${id}.pdf`));
  for (const id of subjectIds) {
    await removeObjects(BUCKETS.resources, await listTree(BUCKETS.resources, id));
  }
  // A photo or icon picked during a rehearsal.
  const photos = await sql`select avatar_url from profiles where id = any(${demoUserIds}) and avatar_url is not null`;
  await removeObjects(
    BUCKETS.profilePhotos,
    photos.map((p) => p.avatar_url).filter((path) => !path.startsWith("http")),
  );
  await sql`update profiles set avatar_url = null, profile_avatar_key = null where id = any(${demoUserIds})`;
  // Week plan files from runs before the week plan was retired (29 October 2026).
  const planFiles = await sql`
    select a.storage_path from class_week_plan_attachments a join class_week_plans p on p.id = a.plan_id
    where p.class_id = any(${classIds}) and a.storage_path is not null
  `;
  await removeObjects(BUCKETS.curriculum, planFiles.map((f) => f.storage_path));
  const quizFiles = await sql`select storage_bucket, storage_path from quiz_attachments where quiz_id = any(${quizIds})`;
  for (const f of quizFiles) await removeObjects(f.storage_bucket, [f.storage_path]);

  // Ids anything else might link to, for the notifications sweep below.
  const linkIds = [...demoUserIds, ...classIds, ...lessonIds, ...homeworkIds, ...quizIds, ...leaveIds];

  await sql.begin(async (tx) => {
    // Approved check-ins refuse changes to their entries, so they go first.
    await tx`delete from tutor_weekly_checkins where tutor_id = any(${tutorIds})`;
    await tx`delete from tutor_bank_details where tutor_id = any(${tutorIds})`;
    await tx`delete from tutor_availability where tutor_id = any(${tutorIds})`;
    await tx`delete from tutor_cover_requests where original_tutor_id = any(${tutorIds}) or replacement_tutor_id = any(${tutorIds}) or lesson_id = any(${lessonIds})`;
    await tx`delete from tutor_leave_requests where tutor_id = any(${tutorIds})`;
    // A lesson outside the demo that a demo tutor took over goes back to its class's tutor.
    await tx`
      update lessons set tutor_id = c.tutor_id from classes c
      where lessons.class_id = c.id and lessons.tutor_id = any(${tutorIds}) and not (c.id = any(${classIds}))
    `;

    await tx`
      delete from notifications
      where user_id = any(${demoUserIds})
         or (href is not null and exists (
              select 1 from unnest(${linkIds}::text[]) as link(id) where notifications.href like '%' || link.id || '%'))
    `;
    await tx`delete from dm_threads where user_a_id = any(${demoUserIds}) or user_b_id = any(${demoUserIds})`;
    await tx`delete from discussion_replies where author_id = any(${demoUserIds})`;
    await tx`delete from discussion_threads where author_id = any(${demoUserIds}) or subject_id = any(${subjectIds})`;
    await tx`
      delete from announcements a
      where a.author_id = any(${demoUserIds})
         or a.audience_class_id = any(${classIds})
         or (exists (select 1 from announcement_recipients r where r.announcement_id = a.id and r.user_id = any(${demoUserIds}))
             and not exists (select 1 from announcement_recipients r where r.announcement_id = a.id and not (r.user_id = any(${demoUserIds}))))
    `;

    await tx`delete from file_markups where owner_id = any(${demoUserIds})`;
    await tx`delete from homework where id = any(${homeworkIds})`;
    await tx`delete from quizzes where id = any(${quizIds})`;
    await tx`delete from lesson_notes where tutor_id = any(${tutorIds}) or student_id = any(${studentIds})`;
    await tx`delete from attendance where student_id = any(${studentIds}) or lesson_id = any(${lessonIds})`;
    await tx`delete from reschedule_requests where student_id = any(${studentIds}) or requested_by_id = any(${demoUserIds})`;
    await tx`delete from lesson_cancellations where student_id = any(${studentIds})`;
    await tx`delete from class_credits where student_id = any(${studentIds})`;
    await tx`delete from class_move_requests where student_id = any(${studentIds})`;
    await tx`delete from lesson_roll_exclusions where student_id = any(${studentIds}) or lesson_id = any(${lessonIds})`;
    await tx`delete from lesson_roll_additions where student_id = any(${studentIds}) or lesson_id = any(${lessonIds})`;
    await tx`delete from allowance_adjustments where student_id = any(${studentIds})`;
    await tx`delete from student_leave where student_id = any(${studentIds})`;
    await tx`delete from student_trials where student_id = any(${studentIds})`;
    await tx`delete from term_report_issues where student_id = any(${studentIds})`;
    await tx`delete from term_report_entries where student_id = any(${studentIds})`;
    await tx`delete from quiz_attempts where student_id = any(${studentIds})`;
    await tx`delete from student_week_progress where student_id = any(${studentIds})`;
    await tx`delete from student_curriculum_term_grants where student_id = any(${studentIds})`;
    await tx`delete from progress_topics where student_id = any(${studentIds}) or subject_id = any(${subjectIds})`;
    await tx`delete from invoices where parent_id = any(${demoUserIds}) or student_id = any(${studentIds})`;
    await tx`delete from enrollments where student_id = any(${studentIds}) or class_id = any(${classIds})`;
    await tx`delete from family_links where parent_id = any(${demoUserIds}) or student_id = any(${demoUserIds})`;
    await tx`delete from tutor_checkin_entries where class_id = any(${classIds})`;
    await tx`delete from lessons where class_id = any(${classIds})`;
    await tx`delete from classes where id = any(${classIds})`;
    await tx`delete from resources where subject_id = any(${subjectIds}) or uploaded_by = any(${demoUserIds})`;
    await tx`delete from subjects where id = any(${subjectIds})`;
    await tx`
      delete from rate_limits
      where lower(identifier) = any(${demoEmails}) or identifier = any(${demoUserIds.map(String)})
    `;
  });
}

await wipe();
if (WIPE_ONLY) {
  console.log("\nDemo data removed. The demo accounts are kept (re-run without --wipe to rebuild).");
  await sql.end();
  process.exit(0);
}

// ----------------------------------------------------------------------------
// The term the demo day falls in. Terms are dev's own data; the seed reads
// them and never changes them.
// ----------------------------------------------------------------------------

const [term] = await sql`
  select id, year, term_number, start_date::text as start, end_date::text as end
  from terms where start_date <= ${today} and end_date >= ${today}
  order by start_date limit 1
`;
if (!term) {
  console.error(
    `\nNo dev term covers ${today}. Add or extend one at /admin/terms (signed in as an admin), then re-run.`,
  );
  await sql.end();
  process.exit(1);
}
const currentWeek = weekNumberOn(term.start, today);
const termWeeks = weekNumberOn(term.start, term.end);
step(`Building for ${today}: ${term.year} Term ${term.term_number}, Week ${currentWeek} of ${termWeeks}`);

/** Weeks from the demo week to the week of `isoDate` (negative = earlier). */
function relWeek(isoDate) {
  return Math.floor((Date.parse(mondayOf(isoDate)) - Date.parse(mondayOf(today))) / (7 * 86_400_000));
}

// ----------------------------------------------------------------------------
// Subjects and their curriculum
// ----------------------------------------------------------------------------

step("Subjects, topics and curriculum weeks");
const subject = {}; // key -> { id, name, weekIds: Map(weekNumber -> id), title(rel) }
for (const [key, s] of Object.entries(SUBJECTS)) {
  const [row] = await sql`
    insert into subjects (name, year_level, color) values (${s.name}, ${s.year}, ${s.color}) returning id
  `;
  const topicIds = [];
  for (const [i, t] of s.topics.entries()) {
    const [topic] = await sql`
      insert into subject_topics (subject_id, name, position) values (${row.id}, ${t.name}, ${i}) returning id
    `;
    topicIds.push({ id: topic.id, from: t.from });
  }
  const indexFor = (rel) => Math.min(s.weeks.length - 1, Math.max(0, s.current + rel));
  const topicFor = (index) => [...topicIds].reverse().find((t) => index >= t.from)?.id ?? null;
  const weekIds = new Map();
  for (let week = 1; week <= termWeeks; week++) {
    const index = indexFor(week - currentWeek);
    const title = s.weeks[index];
    const [w] = await sql`
      insert into subject_weeks (subject_id, term_id, topic_id, week_number, title, description, objectives)
      values (${row.id}, ${term.id}, ${topicFor(index)}, ${week}, ${title}, ${weekDescription(title)}, ${weekObjectives(title)})
      returning id
    `;
    weekIds.set(week, w.id);
  }
  subject[key] = {
    id: row.id,
    name: s.name,
    weekIds,
    title: (rel) => s.weeks[indexFor(rel)],
    /** The curriculum week a date falls in, or null outside the term. */
    weekIdOn: (isoDate) =>
      isoDate >= term.start && isoDate <= term.end ? weekIds.get(weekNumberOn(term.start, isoDate)) ?? null : null,
  };
}

// ----------------------------------------------------------------------------
// Classes, enrolments, families
// ----------------------------------------------------------------------------

step("Classes, enrolments and families");

/** A class slot on the weekday `offset` days from today, in that day's usual hours. */
function slot(offset, { weekdayTimes, weekendTimes }) {
  const day = addDays(today, offset);
  const weekend = [0, 6].includes(weekdayOf(day));
  const [start, end] = weekend ? weekendTimes : weekdayTimes;
  return { day, start, end, name: `${weekdayName(day)} ${Number(start.slice(0, 2)) < 12 ? "AM" : "PM"}` };
}

const GROUP_TIMES = { weekdayTimes: ["16:30", "18:00"], weekendTimes: ["10:00", "11:30"] };
const CLASS_SPECS = [
  { key: "y8", subject: "y8", tutor: "tom", offset: 0, times: GROUP_TIMES, location: "Room 1", type: "group", capacity: 10 },
  { key: "y9e", subject: "y9e", tutor: "tom", offset: -2, times: GROUP_TIMES, location: "Room 2", type: "group", capacity: 10 },
  {
    key: "vce",
    subject: "vce",
    tutor: "tom",
    offset: 1,
    times: { weekdayTimes: ["17:00", "18:00"], weekendTimes: ["11:00", "12:00"] },
    location: "Online",
    type: "one_on_one",
    capacity: 1,
  },
  // Maya's class, on a weekday Tom never teaches, so her lesson fits his week.
  { key: "maya", subject: "y8", tutor: "maya", offset: 3, times: GROUP_TIMES, location: "Room 3", type: "group", capacity: 10 },
];

const cls = {}; // key -> { id, ...spec, slot, display }
for (const spec of CLASS_SPECS) {
  const s = slot(spec.offset, spec.times);
  const [row] = await sql`
    insert into classes (name, subject_id, tutor_id, capacity, class_type, location, is_recurring, weekday, start_time, end_time, created_at)
    values (${s.name}, ${subject[spec.subject].id}, ${people[spec.tutor].id}, ${spec.capacity}, ${spec.type},
      ${spec.location}, true, ${weekdayOf(s.day)}, ${s.start}, ${s.end}, ${at(addDays(today, -70), "09:00")})
    returning id
  `;
  cls[spec.key] = { id: row.id, ...spec, slot: s, display: `${SUBJECTS[spec.subject].name} · ${s.name}` };
}

const enrolledFrom = {}; // studentKey -> ISO date
for (const s of STUDENTS) {
  const since = s.persona === "new" ? addDays(today, -7) : addDays(today, -63);
  enrolledFrom[s.key] = since;
  await sql`
    insert into enrollments (class_id, student_id, enrolled_at)
    values (${cls[s.cls].id}, ${people[s.key].id}, ${at(since, "09:00")})
  `;
  if (s.parent) {
    await sql`
      insert into family_links (parent_id, student_id, relationship, is_primary_contact)
      values (${people[`${s.key}Parent`].id}, ${people[s.key].id}, 'parent', true)
    `;
  }
}

const zara = people.zara;
await sql`
  insert into student_trials (student_id, start_date, end_date, note, created_by_id)
  values (${zara.id}, ${enrolledFrom.zara}, ${addDays(today, 7)}, 'Came to the open day. Family keen on weekly Y8 maths.', ${adminId})
`;
await sql`
  insert into student_leave (student_id, start_date, end_date, note, created_by_id)
  values (${people.leo.id}, ${addDays(today, 4)}, ${addDays(today, 12)}, 'Family holiday interstate', ${adminId})
`;

// ----------------------------------------------------------------------------
// Lessons: six weeks back, today, three weeks ahead.
// ----------------------------------------------------------------------------

step("Lessons, attendance and lesson notes");
const lessons = {}; // classKey -> [{ id, date, rel, start, end }]
for (const c of Object.values(cls)) {
  lessons[c.key] = [];
  for (let k = -6; k <= 3; k++) {
    const date = addDays(c.slot.day, k * 7);
    const [row] = await sql`
      insert into lessons (class_id, tutor_id, date, start_time, end_time, status, created_at)
      values (${c.id}, ${people[c.tutor].id}, ${date}, ${c.slot.start}, ${c.slot.end}, 'upcoming', ${at(addDays(today, -70), "09:00")})
      returning id
    `;
    lessons[c.key].push({ id: row.id, k, date, rel: relWeek(date), start: c.slot.start, end: c.slot.end });
  }
}
const lessonOn = (classKey, date) => lessons[classKey].find((l) => l.date === date);
const todaysLesson = lessonOn("y8", today);
// The one lesson left for the demo to finish: Y9 English two days ago.
const unfinishedLesson = lessonOn("y9e", cls.y9e.slot.day);

/** A student's attendance at one past lesson: mostly present, with each persona's story. */
function attendanceFor(student, lessonIndex) {
  const back = 6 - lessonIndex; // 1 = last lesson, 6 = six lessons ago
  if (student.key === "ava" && back === 2) return { status: "absent", note: "Sick. Mum called the office in the morning." };
  if (student.key === "lucas" && back === 1) return { status: "late", note: "Arrived 15 minutes late (bus)." };
  if (student.key === "noah" && back === 4) return { status: "late", note: "Arrived 10 minutes late." };
  if (student.key === "jack" && back === 3) return { status: "left_early", note: "Left 20 minutes early for footy training." };
  return { status: "present", note: null };
}

const pick = (value, i) => (Array.isArray(value) ? value[i % value.length] : value);
const fill = (text, s) => text?.replaceAll("{first}", s.first) ?? null;

for (const c of Object.values(cls)) {
  const roster = STUDENTS.filter((s) => s.cls === c.key);
  for (const [i, lesson] of lessons[c.key].entries()) {
    if (lesson.date >= today || lesson.id === unfinishedLesson.id) continue;
    for (const s of roster) {
      if (lesson.date < enrolledFrom[s.key]) continue;
      const a = attendanceFor(s, i);
      await sql`
        insert into attendance (lesson_id, student_id, status, note, marked_at, marked_by)
        values (${lesson.id}, ${people[s.key].id}, ${a.status}, ${a.note}, ${at(lesson.date, lesson.end)}, ${people[c.tutor].id})
      `;
      if (a.status === "absent") continue;
      const n = NOTE_BY_PERSONA[s.persona];
      const recent = i >= 4; // the last two lessons
      await sql`
        insert into lesson_notes (lesson_id, student_id, tutor_id, parent_visible_comment, internal_note, created_at)
        values (${lesson.id}, ${people[s.key].id}, ${people[c.tutor].id}, ${fill(pick(n.parent, i), s)},
          ${recent && n.internal ? pick(n.internal, i) : null}, ${at(lesson.date, "18:20")})
      `;
    }
  }
}

// ----------------------------------------------------------------------------
// Homework, submissions and marking
// ----------------------------------------------------------------------------

step("Homework, submissions and files");

async function upload(bucket, path, bytes, contentType = "application/pdf") {
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Upload to ${bucket}/${path} failed: ${error.message}`);
  return path;
}

/**
 * One homework set at a class's lesson (`lesson` counts from the class's
 * lesson this week, so -1 is last week's) and due `dueDays` later at 8 pm.
 * `results(student)` gives each assignment's state.
 */
async function setHomework({ classKey, lesson, dueDays = 6, title, description, attachment, solution, allowResubmission = false, results }) {
  const c = cls[classKey];
  const setAt = lessons[classKey].find((l) => l.k === lesson);
  const due = at(addDays(setAt.date, dueDays), "20:00");
  const tutorId = people[c.tutor].id;
  const [hw] = await sql`
    insert into homework (class_id, lesson_id, tutor_id, created_by_id, title, description, due_date,
      allow_resubmission, week_id, created_at)
    values (${c.id}, ${setAt.id}, ${tutorId}, ${tutorId}, ${title}, ${description}, ${due},
      ${allowResubmission}, ${subject[c.subject].weekIdOn(setAt.date)}, ${at(setAt.date, "18:15")})
    returning id
  `;
  if (attachment) {
    const path = await upload(BUCKETS.attachments, `${tutorId}/${Date.now()}-${randomUUID()}.pdf`, await attachment());
    await sql`update homework set attachment_url = ${path} where id = ${hw.id}`;
  }
  if (solution) {
    const path = await upload(BUCKETS.attachments, `${tutorId}/${Date.now()}-${randomUUID()}.pdf`, await solution());
    await sql`update homework set solution_url = ${path} where id = ${hw.id}`;
  }
  for (const s of STUDENTS.filter((st) => st.cls === classKey && enrolledFrom[st.key] <= setAt.date)) {
    const r = results(s, { setDate: setAt.date, due });
    for (const [field, value] of [["submitted", r.submittedAt], ["marked", r.markedAt]]) {
      if (value && value > now) throw new Error(`${title}: ${s.first}'s work would be ${field} in the future.`);
    }
    let submissionUrl = null;
    if (r.file) {
      submissionUrl = await upload(
        BUCKETS.submissions,
        `${people[s.key].id}/${hw.id}/${Date.now()}-${r.fileName}`,
        await r.file(),
      );
    }
    await sql`
      insert into homework_assignments (homework_id, student_id, status, submitted_at, submission_url, submission_text,
        score, feedback, marked_at, marked_by)
      values (${hw.id}, ${people[s.key].id}, ${r.status}, ${r.submittedAt ?? null}, ${submissionUrl},
        ${r.text ?? null}, ${r.score ?? null}, ${r.feedback ?? null}, ${r.markedAt ?? null},
        ${r.markedAt ? tutorId : null})
    `;
  }
  return hw.id;
}

const hoursBefore = (instant, hours) => new Date(instant.getTime() - hours * 3_600_000);

/** Handed in the evening before it was due and marked the next morning, with the persona's usual mark. */
function markedResult(s, { due }, { scoreShift = 0 } = {}) {
  const f = FEEDBACK_BY_PERSONA[s.persona];
  return {
    status: "marked",
    submittedAt: hoursBefore(due, 22),
    text: "All questions done in my workbook. Working shown for each one.",
    score: Math.min(100, f.score + scoreShift),
    feedback: f.feedback,
    markedAt: hoursBefore(due, -14),
  };
}

// Y8: three weeks of marked homework, then last week's sheet waiting to be marked.
const y8Earlier = [
  { lesson: -4, title: "Algebraic expressions worksheet", shift: -4 },
  { lesson: -3, title: "Substitution practice", shift: 2 },
  { lesson: -2, title: "Like terms worksheet", shift: 0 },
];
for (const h of y8Earlier) {
  await setHomework({
    classKey: "y8",
    lesson: h.lesson,
    title: h.title,
    description: "Complete every question in your workbook and show each step.",
    allowResubmission: true,
    results: (s, ctx) => {
      if (h.lesson === -2 && s.key === "noah") {
        return {
          status: "resubmission_requested",
          submittedAt: hoursBefore(ctx.due, -2),
          text: "Q1-5 done, ran out of time for the rest.",
          score: 40,
          feedback: "Only the first five questions are done. Please finish Q6 to Q8 and resubmit.",
          markedAt: hoursBefore(ctx.due, -14),
        };
      }
      return markedResult(s, ctx, { scoreShift: h.shift });
    },
  });
}

await setHomework({
  classKey: "y8",
  lesson: -1,
  title: "Linear equations practice set",
  description: "Answer all 8 questions on the worksheet. Show every step, then upload a photo or scan of your working.",
  attachment: linearWorksheet,
  solution: linearSolutions,
  allowResubmission: true,
  results: (s, { due }) => {
    switch (s.key) {
      case "ethan":
        return { status: "submitted", submittedAt: hoursBefore(due, 2), fileName: "linear-equations-ethan.pdf", file: () => linearAnswers("Ethan Lim", Y8_ANSWERS.ethan) };
      case "olivia":
        return { status: "submitted", submittedAt: hoursBefore(due, 26), fileName: "Linear equations.pdf", file: () => linearAnswers("Olivia Park", Y8_ANSWERS.olivia) };
      case "noah":
        // Handed in after the deadline: overnight, or an hour ago if the seed runs that early.
        return { status: "late", submittedAt: new Date(Math.min(hoursBefore(now, 1).getTime(), hoursBefore(due, -11).getTime())), fileName: "noah homework.pdf", file: () => linearAnswers("Noah Williams", Y8_ANSWERS.noah) };
      case "ava":
        return { status: "submitted", submittedAt: hoursBefore(due, 1), text: Y8_TEXT_ANSWER };
      case "zara":
        return { status: "viewed" };
      default:
        return { status: "not_started" };
    }
  },
});

// Y9 English (its lesson this week was two days ago): annotated ads (marked),
// last week's persuasive essays to mark, and this week's task not yet due.
await setHomework({
  classKey: "y9e",
  lesson: -2,
  title: "Annotate a persuasive ad",
  description: "Find a print or online ad and label at least four persuasive techniques.",
  results: (s, ctx) => markedResult(s, ctx, { scoreShift: 3 }),
});
await setHomework({
  classKey: "y9e",
  lesson: -1,
  title: "Persuasive essay: school uniforms",
  description: "Write 300 to 400 words arguing for or against compulsory school uniforms. Use at least three persuasive techniques.",
  allowResubmission: true,
  results: (s, { due }) => {
    const essay = Y9_ESSAYS[s.key];
    if (s.key === "mia") {
      return {
        status: "marked",
        submittedAt: hoursBefore(due, 30),
        text: essay,
        score: 92,
        feedback: "A confident, well-structured argument. Your rebuttal paragraph is the strongest part. Next step: vary your sentence openings.",
        markedAt: hoursBefore(now, 20),
      };
    }
    if (s.key === "leo") return { status: "late", submittedAt: hoursBefore(due, -12), text: essay };
    return { status: "submitted", submittedAt: hoursBefore(due, s.key === "jack" ? 3 : 20), text: essay };
  },
});
await setHomework({
  classKey: "y9e",
  lesson: 0,
  title: "Analyse an opinion piece",
  description: "Read the opinion piece from class and write one TEEL paragraph on its main persuasive technique.",
  results: (s) => ({ status: s.key === "mia" ? "viewed" : "not_started" }),
});

// VCE one-on-one (next lesson tomorrow): the factor theorem set waits to be marked.
await setHomework({
  classKey: "vce",
  lesson: -2,
  dueDays: 4,
  title: "Polynomial long division",
  description: "Exercise 4B questions 1 to 12.",
  results: (s, ctx) => markedResult(s, ctx, { scoreShift: -7 }),
});
await setHomework({
  classKey: "vce",
  lesson: -1,
  dueDays: 4,
  title: "Factor theorem problem set",
  description: "Exercise 4C questions 1 to 10. Upload your working as one PDF.",
  results: (s, { due }) => ({
    status: "submitted",
    submittedAt: hoursBefore(due, 5),
    fileName: "Factor theorem - Chloe Tan.pdf",
    file: factorTheoremAnswers,
  }),
});

// ----------------------------------------------------------------------------
// Curriculum extras: booklets and quizzes
// ----------------------------------------------------------------------------

step("Booklets and quizzes");
const KHAN_BRACKETS = "https://www.youtube.com/watch?v=YZBStgZGyDY";
for (const rel of [-1, 0]) {
  const weekId = subject.y8.weekIdOn(addDays(today, rel * 7));
  if (!weekId) continue;
  const weekNumber = currentWeek + rel;
  const title = subject.y8.title(rel);
  const path = await upload(
    BUCKETS.curriculum,
    `booklets/${weekId}.pdf`,
    await weekBooklet({
      subject: SUBJECTS.y8.name,
      weekNumber,
      title,
      sections: [
        { heading: "Key idea", lines: [weekDescription(title)] },
        {
          heading: "Worked example",
          lines: rel === 0
            ? ["Solve 3(x + 2) = 21.", "Expand: 3x + 6 = 21.", "Subtract 6: 3x = 15.", "Divide by 3: x = 5.", "Check: 3(5 + 2) = 21."]
            : ["Solve 2x - 5 = 11.", "Add 5: 2x = 16.", "Divide by 2: x = 8.", "Check: 2(8) - 5 = 11."],
        },
        { heading: "Practice", lines: ["Booklet questions 1 to 12. Show every line of working."] },
      ],
    }),
  );
  await sql`
    update subject_weeks set booklet_url = ${path}, updated_at = now()
    where id = ${weekId}
  `;
}

/** A quiz with multiple-choice questions; `answers[i]` is the correct option index. */
async function makeQuiz({ subjectKey, rel, title, status, assignedTutor = null, note = null, reviewNote = null, questions, createdBy = adminId }) {
  const weekId = subject[subjectKey].weekIdOn(addDays(today, rel * 7));
  if (!weekId) return null;
  const approved = status === "approved";
  const [quiz] = await sql`
    insert into quizzes (subject_id, subject_week_id, title, status, created_by, assigned_tutor_id, note,
      review_note, review_note_at, approved_by, approved_at, created_at, updated_at)
    values (${subject[subjectKey].id}, ${weekId}, ${title}, ${status}, ${createdBy}, ${assignedTutor}, ${note},
      ${reviewNote}, ${reviewNote ? new Date(now.getTime() - 26 * 3_600_000) : null},
      ${approved ? adminId : null}, ${approved ? at(addDays(today, rel * 7 - 3), "10:00") : null},
      ${new Date(now.getTime() - 3 * 86_400_000)}, ${new Date(now.getTime() - (reviewNote ? 26 : 48) * 3_600_000)})
    returning id
  `;
  for (const [i, q] of questions.entries()) {
    const [question] = await sql`
      insert into quiz_questions (quiz_id, prompt, type, position) values (${quiz.id}, ${q.prompt}, 'multiple_choice', ${i})
      returning id
    `;
    for (const [j, option] of q.options.entries()) {
      await sql`
        insert into quiz_options (question_id, text, is_correct, position)
        values (${question.id}, ${option}, ${j === q.answer}, ${j})
      `;
    }
  }
  return quiz.id;
}

const twoStepQuiz = await makeQuiz({
  subjectKey: "y8",
  rel: -1,
  title: "Two-step equations check",
  status: "approved",
  assignedTutor: tomId,
  createdBy: adminId,
  questions: [
    { prompt: "Solve 2x + 3 = 11", options: ["x = 4", "x = 7", "x = 14"], answer: 0 },
    { prompt: "Solve 5x - 2 = 18", options: ["x = 3.2", "x = 4", "x = 20"], answer: 1 },
    { prompt: "Solve x/3 + 1 = 5", options: ["x = 12", "x = 18", "x = 2"], answer: 0 },
    { prompt: "Solve 4 - x = 9", options: ["x = 5", "x = -5", "x = 13"], answer: 1 },
    { prompt: "Which first step solves 7x + 4 = 25?", options: ["Divide by 7", "Subtract 4 from both sides", "Add 4 to both sides"], answer: 1 },
  ],
});
const bracketsQuiz = await makeQuiz({
  subjectKey: "y8",
  rel: 0,
  title: "Equations with brackets",
  status: "approved",
  assignedTutor: tomId,
  questions: [
    { prompt: "Expand 3(x + 2)", options: ["3x + 2", "3x + 6", "x + 6"], answer: 1 },
    { prompt: "Solve 2(x - 1) = 10", options: ["x = 6", "x = 5.5", "x = 4"], answer: 0 },
    { prompt: "Solve 4(x + 3) = 32", options: ["x = 5", "x = 8", "x = 29"], answer: 0 },
    { prompt: "Expand -2(x - 4)", options: ["-2x - 8", "-2x + 8", "2x + 8"], answer: 1 },
  ],
});
for (const [key, correct] of [["olivia", 5], ["ethan", 3], ["ava", 4], ["noah", 2], ["lucas", 4]]) {
  await sql`
    insert into quiz_attempts (quiz_id, student_id, correct_count, total, submitted_at)
    values (${twoStepQuiz}, ${people[key].id}, ${correct}, 5, ${at(addDays(today, -4), "19:30")})
  `;
}
for (const [key, correct] of [["olivia", 4], ["ava", 3]]) {
  await sql`
    insert into quiz_attempts (quiz_id, student_id, correct_count, total, submitted_at)
    values (${bracketsQuiz}, ${people[key].id}, ${correct}, 4, ${new Date(now.getTime() - 5 * 3_600_000)})
  `;
}
const requestedQuiz = await makeQuiz({
  subjectKey: "y8",
  rel: 1,
  title: "Unknowns on both sides",
  status: "requested",
  assignedTutor: tomId,
  note: "Six to eight multiple-choice questions, including one worded problem. Please submit it before next week's lesson.",
  questions: [],
});
const changesQuiz = await makeQuiz({
  subjectKey: "vce",
  rel: 1,
  title: "Solving cubic equations",
  status: "changes_requested",
  assignedTutor: tomId,
  note: "A short check on solving cubics with the factor theorem.",
  reviewNote: "Question 3 has two options that are both correct. Please fix them, then send it back for review.",
  questions: [
    { prompt: "Which is a factor of x³ - 6x² + 11x - 6?", options: ["x + 1", "x - 1", "x + 6"], answer: 1 },
    { prompt: "Solve x³ - x = 0", options: ["x = 0, 1, -1", "x = 1 only", "x = 0 only"], answer: 0 },
    { prompt: "How many real solutions can a cubic have?", options: ["1 or 3 (counting repeats: up to 3)", "Up to 3", "Exactly 2"], answer: 1 },
    { prompt: "If P(2) = 0, then", options: ["(x + 2) is a factor", "(x - 2) is a factor", "P has no real roots"], answer: 1 },
  ],
});

// ----------------------------------------------------------------------------
// Resource library
// ----------------------------------------------------------------------------

step("Resource library");
{
  const algebra = (await sql`select id from subject_topics where subject_id = ${subject.y8.id} and name = 'Algebra'`)[0]?.id ?? null;
  const formula = await formulaSheet();
  const formulaPath = await upload(BUCKETS.resources, `${subject.y8.id}/${randomUUID()}.pdf`, formula);
  await sql`
    insert into resources (subject_id, topic_id, type, kind, title, description, storage_bucket, storage_path, content_type,
      size_bytes, uploaded_by, created_at)
    values (${subject.y8.id}, ${algebra}, 'formula_sheet', 'file', 'Algebra rules: formula sheet',
      'Inverse operations, expanding brackets and checking a solution on one page.', ${BUCKETS.resources}, ${formulaPath},
      'application/pdf', ${formula.byteLength}, ${tomId}, ${new Date(now.getTime() - 9 * 86_400_000)})
  `;
  await sql`
    insert into resources (subject_id, topic_id, type, kind, title, description, external_url, uploaded_by, created_at)
    values (${subject.y8.id}, ${algebra}, 'video', 'link', 'Solving equations with brackets (Khan Academy)',
      'A 5-minute walkthrough of expanding brackets before solving.', ${KHAN_BRACKETS}, ${mayaId},
      ${new Date(now.getTime() - 5 * 86_400_000)})
  `;
  const planner = await essayPlanner();
  const plannerPath = await upload(BUCKETS.resources, `${subject.y9e.id}/${randomUUID()}.pdf`, planner);
  await sql`
    insert into resources (subject_id, type, kind, title, description, storage_bucket, storage_path, content_type, size_bytes, uploaded_by, created_at)
    values (${subject.y9e.id}, 'writing_template', 'file', 'Persuasive essay planner (TEEL)',
      'A one-page planner for a five-paragraph persuasive essay.', ${BUCKETS.resources}, ${plannerPath},
      'application/pdf', ${planner.byteLength}, ${tomId}, ${new Date(now.getTime() - 12 * 86_400_000)})
  `;
}

// ----------------------------------------------------------------------------
// Term reports, availability, cover, pay
// ----------------------------------------------------------------------------

step("Term reports, availability, cover and weekly hours");
const REPORTS = {
  olivia: [
    "Olivia sets out every step clearly and checks her answers without being asked.",
    "Taking on the extension questions each week to stretch her problem solving.",
    "Keep her homework average above 90% and start Year 9 algebra early.",
  ],
  mia: [
    "Mia writes structured, convincing arguments and her rebuttals are a real strength.",
    "Varying sentence openings and tightening conclusions.",
    "Try a timed essay each fortnight and enter the school debating team.",
  ],
  chloe: [
    "Chloe has a strong grasp of polynomials and works through long division accurately.",
    "Setting out the factor theorem steps fully in exam conditions.",
    "Finish the cubic graphs unit with a practice SAC above 85%.",
  ],
};
for (const [key, [strengths, toWorkOn, goals]] of Object.entries(REPORTS)) {
  const s = STUDENTS.find((st) => st.key === key);
  await sql`
    insert into term_report_entries (student_id, term_id, subject_id, strengths, to_work_on, goals, written_by)
    values (${people[key].id}, ${term.id}, ${subject[s.cls].id}, ${strengths}, ${toWorkOn}, ${goals}, ${tomId})
  `;
}

// Tom's usual week: weekday afternoons and weekend mornings, as hourly rows
// the way the Schedule editor saves them.
for (const weekday of [1, 2, 3, 4, 5]) {
  for (let hour = 15; hour < 20; hour++) {
    await sql`
      insert into tutor_availability (tutor_id, weekday, start_time, end_time, is_available)
      values (${tomId}, ${weekday}, ${`${hour}:00`}, ${`${hour + 1}:00`}, true)
    `;
  }
}
for (const weekday of [0, 6]) {
  for (let hour = 9; hour < 13; hour++) {
    await sql`
      insert into tutor_availability (tutor_id, weekday, start_time, end_time, is_available)
      values (${tomId}, ${weekday}, ${`${String(hour).padStart(2, "0")}:00`}, ${`${hour + 1}:00`}, true)
    `;
  }
}

const mayaNext = lessonOn("maya", cls.maya.slot.day);
const mayaLater = lessonOn("maya", addDays(cls.maya.slot.day, 7));
const HANDOVER = `We're on ${subject.y8.title(0).toLowerCase()} this week: booklet pages 4 to 6, then the exit quiz. Isaac needs a nudge to show his working.`;
await sql`
  insert into tutor_cover_requests (lesson_id, original_tutor_id, reason, handover_note, status, created_at, updated_at)
  values (${mayaNext.id}, ${mayaId}, 'Medical appointment', ${HANDOVER}, 'open',
    ${new Date(now.getTime() - 20 * 3_600_000)}, ${new Date(now.getTime() - 20 * 3_600_000)})
`;
await sql`
  insert into tutor_cover_requests (lesson_id, original_tutor_id, replacement_tutor_id, reason, handover_note, status,
    claimed_at, created_at, updated_at)
  values (${mayaLater.id}, ${mayaId}, ${tomId}, 'School camp supervision',
    'Revision week: run the practice test from the resource library, then go through Q5 to Q8 together.', 'claimed',
    ${new Date(now.getTime() - 50 * 3_600_000)}, ${new Date(now.getTime() - 3 * 86_400_000)}, ${new Date(now.getTime() - 50 * 3_600_000)})
`;
// A claim moves the lesson onto the covering tutor's schedule and pay.
await sql`update lessons set tutor_id = ${tomId} where id = ${mayaLater.id}`;
const tomAway = lessonOn("vce", addDays(cls.vce.slot.day, 14));
await sql`
  insert into tutor_cover_requests (lesson_id, original_tutor_id, reason, handover_note, status, created_at, updated_at)
  values (${tomAway.id}, ${tomId}, 'Family wedding interstate',
    'Chloe is up to cubic graphs. Past paper questions 3 to 5, then mark them together.', 'open',
    ${new Date(now.getTime() - 4 * 86_400_000)}, ${new Date(now.getTime() - 4 * 86_400_000)})
`;

const RATE = "45.00";
for (const id of tutorIds) {
  await sql`insert into tutor_bank_details (tutor_id, hourly_rate, updated_by_id) values (${id}, ${RATE}, ${adminId})`;
}

// Weekly check-ins: every earlier week approved, last week waiting for Tom.
{
  const lastWeek = addDays(mondayOf(today), -7);
  const tomLessons = await sql`
    select l.id, l.class_id, l.date::text as date, l.start_time::text as start, l.end_time::text as end,
      s.name as subject_name, c.name as class_name
    from lessons l join classes c on c.id = l.class_id join subjects s on s.id = c.subject_id
    where l.tutor_id = ${tomId} and l.date < ${mondayOf(today)}
    order by l.date
  `;
  const weeks = new Map();
  for (const l of tomLessons) {
    const w = mondayOf(l.date);
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w).push(l);
  }
  for (const [weekStart, rows] of weeks) {
    const [checkin] = await sql`
      insert into tutor_weekly_checkins (tutor_id, week_start, status, created_at)
      values (${tomId}, ${weekStart}, 'pending', ${at(addDays(weekStart, 6), "18:00")})
      returning id
    `;
    for (const l of rows) {
      await sql`
        insert into tutor_checkin_entries (checkin_id, lesson_id, class_id, subject_name, class_name, work_date,
          start_time, end_time, minutes, hourly_rate)
        values (${checkin.id}, ${l.id}, ${l.class_id}, ${l.subject_name}, ${l.class_name}, ${l.date},
          ${l.start}, ${l.end}, ${minutesBetween(l.start, l.end)}, ${RATE})
      `;
    }
    if (weekStart < lastWeek) {
      await sql`
        update tutor_weekly_checkins set status = 'approved', approved_at = ${at(addDays(weekStart, 7), "09:30")}
        where id = ${checkin.id}
      `;
    }
  }
}

// ----------------------------------------------------------------------------
// Class announcements
// ----------------------------------------------------------------------------

step("Class announcements");
{
  const [a] = await sql`
    insert into announcements (author_id, title, body, audience_class_id, status, target_roles, target_class_ids,
      approved_by_id, approved_at, published_at)
    values (${tomId}, 'Bring your booklet this week',
      'Please bring your algebra booklet and a calculator to every lesson this term. We will use them in class each week.',
      ${cls.y8.id}, 'published', ${sql.json(["student"])}, ${sql.json([cls.y8.id])}, ${adminId},
      ${at(addDays(today, -5), "09:00")}, ${at(addDays(today, -5), "09:00")})
    returning id
  `;
  for (const s of STUDENTS.filter((st) => st.cls === "y8")) {
    await sql`insert into announcement_recipients (announcement_id, user_id, created_at) values (${a.id}, ${people[s.key].id}, ${at(addDays(today, -5), "09:00")})`;
  }
  await sql`
    insert into announcements (author_id, title, body, audience_class_id, status, target_roles, target_class_ids, published_at)
    values (${tomId}, 'Essay feedback session',
      'Next lesson we will spend the first 20 minutes going through your persuasive essay feedback. Bring your marked essay.',
      ${cls.y9e.id}, 'pending', ${sql.json(["student"])}, ${sql.json([cls.y9e.id])}, ${new Date(now.getTime() - 3 * 3_600_000)})
  `;
}

// ----------------------------------------------------------------------------
// Discussions and direct messages
// ----------------------------------------------------------------------------

step("Discussions and messages");
const hoursAgo = (h) => new Date(now.getTime() - h * 3_600_000);

/** `author` is a demo person's key, or "admin" for the office. */
const authorId = (key) => (key === "admin" ? adminId : people[key].id);

async function thread({ subjectKey, author, title, body, when, replies = [] }) {
  const last = replies.length ? replies[replies.length - 1].when : when;
  const [t] = await sql`
    insert into discussion_threads (subject_id, author_id, title, body, created_at, last_activity_at)
    values (${subjectKey ? subject[subjectKey].id : null}, ${authorId(author)}, ${title}, ${body}, ${hoursAgo(when)}, ${hoursAgo(last)})
    returning id
  `;
  for (const r of replies) {
    await sql`
      insert into discussion_replies (thread_id, author_id, body, created_at)
      values (${t.id}, ${authorId(r.author)}, ${r.body}, ${hoursAgo(r.when)})
    `;
  }
  return t.id;
}

await thread({
  subjectKey: "y8",
  author: "ethan",
  title: "How do I get rid of the brackets in 3(x + 2) = 21?",
  body: "I keep getting x = 6.33 for question 4 on the practice set. I did 3x + 2 = 21. What am I doing wrong?",
  when: 14,
});
await thread({
  subjectKey: "y8",
  author: "olivia",
  title: "Can we check answers by substituting?",
  body: "Is it OK to check my answers by putting them back into the equation, or do we lose marks for that?",
  when: 96,
  replies: [
    {
      author: "tom",
      body: "Yes, please do! Substituting your answer back in is the best way to check it, and you never lose marks for checking.",
      when: 90,
    },
  ],
});
await thread({
  subjectKey: "y8",
  author: "isaac",
  title: "Is this week's quiz open book?",
  body: "Can we use the booklet during the quiz?",
  when: 30,
  replies: [{ author: "maya", body: "Not this time, Isaac. Try it from memory, then check the booklet afterwards.", when: 28 }],
});
await thread({
  subjectKey: "y9e",
  author: "sophie",
  title: "Can we use 'I' in a persuasive essay?",
  body: "My school teacher said never to use 'I' in essays. Is that the same for persuasive writing?",
  when: 40,
});
await thread({
  subjectKey: null,
  author: "maya",
  title: "How do I add a recording link to a lesson?",
  body: "I recorded my Y8 lesson on Zoom. Where do I put the link so students can watch it?",
  when: 72,
  replies: [
    {
      author: "admin",
      body: "Open the lesson from your Today page or schedule, then paste the link into the Recording card on the right.",
      when: 70,
    },
  ],
});

/** A DM thread with messages oldest first; `tomReadAt` is when Tom last read it (null: never). */
async function dm(otherId, messages, { tomReadAt = null } = {}) {
  const [a, b] = [tomId, otherId].sort();
  const last = messages[messages.length - 1];
  const [t] = await sql`
    insert into dm_threads (user_a_id, user_b_id, created_at, last_activity_at)
    values (${a}, ${b}, ${hoursAgo(messages[0].when)}, ${hoursAgo(last.when)})
    returning id
  `;
  for (const m of messages) {
    await sql`
      insert into dm_messages (thread_id, sender_id, body, created_at)
      values (${t.id}, ${m.from === "tom" ? tomId : otherId}, ${m.body}, ${hoursAgo(m.when)})
    `;
  }
  // The other side has read everything; Tom has read up to `tomReadAt`.
  await sql`insert into dm_reads (user_id, thread_id, last_read_at) values (${otherId}, ${t.id}, ${hoursAgo(last.when)})`;
  if (tomReadAt !== null) {
    await sql`insert into dm_reads (user_id, thread_id, last_read_at) values (${tomId}, ${t.id}, ${hoursAgo(tomReadAt)})`;
  }
  return t.id;
}

const graceThread = await dm(people.ethanParent.id, [
  {
    from: "other",
    body: "Hi Tom, Ethan said he found the brackets questions hard on this week's sheet. Is there anything we can do at home to help him?",
    when: 5,
  },
]);
const chloeThread = await dm(people.chloe.id, [
  {
    from: "other",
    body: "Hi Tom, for our next lesson could we go over Q4 from the factor theorem set? I got stuck on the division part.",
    when: 16,
  },
]);
await dm(
  people.noahParent.id,
  [
    {
      from: "tom",
      body: "Hi Sarah, a quick heads up that Noah's last two homework sheets came in late. Could you help him find a regular homework time?",
      when: 74,
    },
    { from: "other", body: "Thanks Tom, we've set up homework time after dinner. He'll get it in.", when: 70 },
  ],
  { tomReadAt: 69 },
);
await dm(
  adminId,
  [
    {
      from: "other",
      body: "Hi Tom, Zara Ahmed is joining your Y8 class on a free trial this week. Could you send us a quick note on how she settles in before the trial ends?",
      when: 150,
    },
    { from: "tom", body: "Will do. I'll keep an eye on her and report back next week.", when: 148 },
  ],
  { tomReadAt: 148 },
);

// ----------------------------------------------------------------------------
// Tom's notifications, as the app would have sent them
// ----------------------------------------------------------------------------

step("Notifications");
async function notify(userId, { title, body = null, href = null, when, read = false, dedupeKey = null }) {
  const created = hoursAgo(when);
  await sql`
    insert into notifications (user_id, channel, title, body, href, dedupe_key, read_at, created_at)
    values (${userId}, 'in_app', ${title}, ${body}, ${href}, ${dedupeKey}, ${read ? new Date(created.getTime() + 600_000) : null}, ${created})
  `;
}

await notify(tomId, { title: "New message from Grace Lim", href: `/tutor/messages/${graceThread}`, when: 5 });
await notify(tomId, { title: "New message from Chloe Tan", href: `/tutor/messages/${chloeThread}`, when: 16 });
const freeTrialWhen = Math.max(0.2, (now.getTime() - at(today, "07:00").getTime()) / 3_600_000);
await notify(tomId, {
  title: "Free-trial student today",
  body: `Zara Ahmed has a free trial today: ${cls.y8.display}, ${formatTimeRange(cls.y8.slot.start, cls.y8.slot.end)}, with Tom Tutor.`,
  href: `/tutor/lessons/${todaysLesson.id}`,
  when: freeTrialWhen,
  dedupeKey: `free-trial-today:${todaysLesson.id}:${zara.id}`,
});
if (requestedQuiz) {
  await notify(tomId, {
    title: "Quiz requested",
    body: `Build "Unknowns on both sides" for ${SUBJECTS.y8.name}, Term ${term.term_number} Week ${currentWeek + 1}. Admin's note: Six to eight multiple-choice questions, including one worded problem. Please submit it before next week's lesson.`,
    href: `/tutor/quizzes/${requestedQuiz}`,
    when: 48,
  });
}
if (changesQuiz) {
  await notify(tomId, {
    title: "Changes requested",
    body: "Question 3 has two options that are both correct. Please fix them, then send it back for review.",
    href: `/tutor/quizzes/${changesQuiz}`,
    when: 26,
  });
}
// Same wording as tutor-cover.ts, via tutorCoverLessonDescription: the
// weekday is dropped from the date when the class name already says it.
const coverDate = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
  .format(new Date(`${mayaLater.date}T00:00:00Z`));
const coverWeekday = coverDate.split(" ")[0].toLowerCase();
const coverDetail = `${cls.maya.display}, ${
  cls.maya.slot.name.toLowerCase().split(/[^a-z]+/).includes(coverWeekday) ? coverDate.split(" ").slice(1).join(" ") : coverDate
} ${formatTimeRange(mayaLater.start, mayaLater.end)}`;
await notify(tomId, {
  title: "Cover confirmed",
  body: `You are now teaching ${coverDetail}. It has been added to your schedule.`,
  href: "/tutor/cover",
  when: 50,
  read: true,
});
{
  const [a] = await sql`
    insert into announcements (author_id, title, body, status, target_roles, target_tutor_ids, approved_by_id, approved_at, published_at)
    values (${adminId}, 'Term reports are open',
      'Term reports are open for writing. Please write a short summary for each of your students before the end of term. Find them under Term reports in the menu.',
      'published', ${sql.json(["tutor"])}, ${sql.json(tutorIds)}, ${adminId}, ${hoursAgo(120)}, ${hoursAgo(120)})
    returning id
  `;
  for (const id of tutorIds) {
    await sql`insert into announcement_recipients (announcement_id, user_id, created_at) values (${a.id}, ${id}, ${hoursAgo(120)})`;
    await notify(id, {
      title: "New announcement: Term reports are open",
      body: "Term reports are open for writing. Please write a short summary for each of your students before the end of term. Find them under Term reports in the menu.",
      href: `/tutor/notifications?announcement=${a.id}`,
      dedupeKey: `announcement:${a.id}`,
      when: 120,
      read: true,
    });
  }
}
await notify(tomId, {
  title: "New class assigned",
  body: `${cls.y8.display} · ${weekdayName(cls.y8.slot.day)}s ${formatTimeRange(cls.y8.slot.start, cls.y8.slot.end)} · ${cls.y8.location}`,
  href: "/tutor/timetable",
  dedupeKey: `class-created:${cls.y8.id}:tutor`,
  when: 70 * 24,
  read: true,
});

// ----------------------------------------------------------------------------

const [counts] = await sql`
  select
    (select count(*) from homework_assignments a join homework h on h.id = a.homework_id
      where h.class_id = any(${[cls.y8.id, cls.y9e.id, cls.vce.id]}) and a.status in ('submitted', 'late'))::int as to_mark,
    (select count(*) from lessons where tutor_id = ${tomId})::int as lessons,
    (select count(*) from lesson_notes where tutor_id = ${tomId})::int as notes
`;
console.log(`
Done. Sign in at http://localhost:3000/login as ${TUTOR.email} / ${TUTOR.password}
  Classes:      ${cls.y8.display} (today), ${cls.y9e.display}, ${cls.vce.display} (one-on-one)
  To mark:      ${counts.to_mark} submissions (Ethan's PDF is the one to annotate)
  To finish:    ${cls.y9e.display} on ${unfinishedLesson.date} (attendance not marked)
  Cover board:  ${cls.maya.display} on ${mayaNext.date}, from Maya Collins
  Lessons:      ${counts.lessons}, lesson notes: ${counts.notes}
  Other logins: any demo student or parent (see docs/demo/tutor-demo.md) / ${OTHERS_PASSWORD}`);
await sql.end();
