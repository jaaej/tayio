import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  familyLinks,
  lessons,
  profiles,
  subjects,
  tutorAvailability,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { classDisplayName, classNameDetail } from "@/lib/class-display";
import { formatDateShort } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { STUDENT_TIERS } from "@/lib/roles";
import { roomsInUse } from "@/app/admin/classes/_lib/rooms";
import type { TutorClassSlot, TutorWeeklyWindow } from "@/app/admin/classes/_lib/tutor-fit";
import { SubjectEditForm, type EditClass } from "./_components/subject-edit-form";
import type { CardStudent } from "./_lib/class-card";
import { distinctSubjects } from "@/lib/subject-label";

export const dynamic = "force-dynamic";

/**
 * The home of a subject and all its classes (admin edit handoff, plus what
 * the old class page held): the subject's name, level and colour; each
 * class's day, time, tutor, room, name, type, capacity, link and students;
 * and the deletes. One Save saves everything. `/admin/classes/[id]` redirects
 * here, to the class's card.
 */
export default async function EditSubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [subject] = await db
    .select({ id: subjects.id, name: subjects.name, yearLevel: subjects.yearLevel, color: subjects.color })
    .from(subjects)
    .where(eq(subjects.id, id));
  if (!subject) notFound();

  const today = melbourneDate(new Date());
  const [classRows, allSlots, tutorRows, subjectRows, studentRows, availabilityRows] = await Promise.all([
    db
      .select({
        id: classes.id,
        name: classes.name,
        tutorId: classes.tutorId,
        isRecurring: classes.isRecurring,
        weekday: classes.weekday,
        startTime: classes.startTime,
        endTime: classes.endTime,
        location: classes.location,
        classType: classes.classType,
        capacity: classes.capacity,
        onlineLink: classes.onlineLink,
      })
      .from(classes)
      .where(eq(classes.subjectId, id))
      .orderBy(sql`${classes.weekday} nulls last`, asc(classes.startTime), asc(classes.name)),
    // Every weekly class's slot: "Taken at this time" on the room chips, and
    // a tutor already teaching then in the tutor list.
    db
      .select({
        id: classes.id,
        weekday: classes.weekday,
        startTime: classes.startTime,
        endTime: classes.endTime,
        room: classes.location,
        tutorId: classes.tutorId,
        name: classes.name,
        subjectName: subjects.name,
      })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(and(eq(classes.isRecurring, true), isNotNull(classes.weekday))),
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        isActive: profiles.isActive,
      })
      .from(profiles)
      .where(eq(profiles.role, "tutor"))
      .orderBy(asc(profiles.firstName), asc(profiles.lastName)),
    // Where a class can be moved.
    db
      .select({ id: subjects.id, name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .then((rows) => distinctSubjects(rows).map((s) => ({ id: s.id, name: s.label }))),
    // Everyone who can be added to a class.
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        school: profiles.school,
      })
      .from(profiles)
      .where(inArray(profiles.role, STUDENT_TIERS))
      .orderBy(asc(profiles.firstName), asc(profiles.lastName)),
    // Weekly availability, to rank tutors for a class's day and time (as in
    // New class; date-specific rows are one-off changes).
    db
      .selectDistinct({
        tutorId: tutorAvailability.tutorId,
        weekday: tutorAvailability.weekday,
        startTime: tutorAvailability.startTime,
        endTime: tutorAvailability.endTime,
        subjectId: tutorAvailability.subjectId,
      })
      .from(tutorAvailability)
      .where(
        and(
          isNotNull(tutorAvailability.weekday),
          isNull(tutorAvailability.date),
          eq(tutorAvailability.isAvailable, true),
        ),
      ),
  ]);

  // Per class: students, their parents, lessons run, and the first lesson.
  const classIds = classRows.map((c) => c.id);
  const [enrolledRows, parentRows, lessonRows] = classIds.length
    ? await Promise.all([
        db
          .select({
            classId: enrollments.classId,
            studentId: enrollments.studentId,
            deliveryMode: enrollments.deliveryMode,
            adminNotes: enrollments.adminNotes,
            firstName: profiles.firstName,
            lastName: profiles.lastName,
            email: profiles.email,
            school: profiles.school,
          })
          .from(enrollments)
          .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
          .where(and(inArray(enrollments.classId, classIds), isNull(enrollments.withdrawnAt)))
          .orderBy(asc(profiles.firstName), asc(profiles.lastName)),
        db
          .select({
            classId: enrollments.classId,
            n: sql<number>`count(distinct ${familyLinks.parentId})::int`,
          })
          .from(familyLinks)
          .innerJoin(enrollments, eq(enrollments.studentId, familyLinks.studentId))
          .where(and(inArray(enrollments.classId, classIds), isNull(enrollments.withdrawnAt)))
          .groupBy(enrollments.classId),
        db
          .select({
            classId: lessons.classId,
            ran: sql<number>`count(*) filter (where ${lessons.status} <> 'cancelled' and (${lessons.date} < ${today} or ${lessons.status} in ('completed', 'missed')))::int`,
            first: sql<string | null>`(min(${lessons.date}) filter (where ${lessons.status} = 'upcoming' and ${lessons.date} >= ${today}))::text`,
          })
          .from(lessons)
          .where(inArray(lessons.classId, classIds))
          .groupBy(lessons.classId),
      ])
    : [[], [], []];
  const studentsBy = new Map<string, CardStudent[]>();
  for (const r of enrolledRows) {
    const list = studentsBy.get(r.classId) ?? [];
    const saved = { deliveryMode: r.deliveryMode, adminNotes: r.adminNotes ?? "" };
    list.push({
      id: r.studentId,
      name: `${r.firstName} ${r.lastName}`.trim(),
      detail: studentDetail(r),
      saved,
      ...saved,
      leaving: false,
    });
    studentsBy.set(r.classId, list);
  }
  const parentsBy = new Map(parentRows.map((r) => [r.classId, r.n]));
  const lessonsBy = new Map(lessonRows.map((r) => [r.classId, r]));

  const assigned = new Set(classRows.map((c) => c.tutorId));
  const tutors = tutorRows
    .filter((t) => t.isActive || assigned.has(t.id))
    .map((t) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      name: `${t.firstName} ${t.lastName}`.trim(),
    }));
  const tutorName = (tid: string) => tutors.find((t) => t.id === tid)?.name ?? "the tutor";

  // Students in any of the classes, counted once.
  const [{ students } = { students: 0 }] = classIds.length
    ? await db
        .select({ students: sql<number>`count(distinct ${enrollments.studentId})::int` })
        .from(enrollments)
        .where(
          and(
            inArray(enrollments.classId, classIds),
            isNull(enrollments.withdrawnAt),
          ),
        )
    : [];

  const editClasses: EditClass[] = classRows.map((c) => {
    const weekly = c.isRecurring && c.weekday !== null;
    const roster = studentsBy.get(c.id) ?? [];
    const enrolled = roster.length;
    const ran = lessonsBy.get(c.id)?.ran ?? 0;
    const firstLesson = lessonsBy.get(c.id)?.first ?? null;
    const meta = [
      `${enrolled} ${enrolled === 1 ? "student" : "students"}`,
      ran > 0
        ? `${ran} ${ran === 1 ? "lesson" : "lessons"} run`
        : firstLesson
          ? `starts ${formatDateShort(firstLesson)}`
          : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: c.id,
      title: classNameDetail(subject.name, c.name) || c.name,
      meta,
      enrolled,
      parents: parentsBy.get(c.id) ?? 0,
      students: roster,
      details: {
        name: c.name,
        subjectId: subject.id,
        classType: c.classType,
        capacity: c.capacity,
        onlineLink: c.onlineLink ?? "",
      },
      saved: {
        weekday: weekly ? c.weekday : null,
        startTime: weekly && c.startTime ? c.startTime.slice(0, 5) : "",
        endTime: weekly && c.endTime ? c.endTime.slice(0, 5) : "",
        room: c.location ?? "",
        tutorId: c.tutorId,
      },
    };
  });

  const tutorsInClasses = [...new Set(classRows.map((c) => tutorName(c.tutorId)))];
  const sub = [
    `${students} ${students === 1 ? "student" : "students"}`,
    tutorsInClasses.join(", ") || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SubjectEditForm
      subject={{
        id: subject.id,
        name: subject.name,
        yearLevel: subject.yearLevel ?? "",
        color: subjectTone(subject.name, subject.color).color,
      }}
      sub={sub}
      classes={editClasses}
      tutors={tutors}
      rooms={[...roomsInUse(allSlots.map((s) => s.room)).filter((r) => r.toLowerCase() !== "online"), "Online"]}
      otherSlots={allSlots.map((s) => ({
        classId: s.id,
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
      }))}
      tutorWindows={availabilityRows.map(
        (r): TutorWeeklyWindow => ({
          tutorId: r.tutorId,
          weekday: r.weekday!,
          startTime: r.startTime,
          endTime: r.endTime,
          subjectId: r.subjectId,
        }),
      )}
      classSlots={allSlots.map(
        (s): TutorClassSlot & { classId: string } => ({
          classId: s.id,
          tutorId: s.tutorId,
          name: classDisplayName(s.subjectName, s.name),
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
        }),
      )}
      subjects={subjectRows}
      students={studentRows.map((r) => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`.trim(),
        detail: studentDetail(r),
      }))}
    />
  );
}

/** "Glen Waverley SC · noah@taiyo.com", or just the email. */
function studentDetail(r: { email: string; school: string | null }) {
  return r.school ? `${r.school} · ${r.email}` : r.email;
}
