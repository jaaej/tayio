import "server-only";
import { and, between, eq, gte, inArray, lt, lte, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  lessons,
  profiles,
  subjectWeeks,
  subjects,
  termReportEntries,
  terms,
} from "@/db/schema";
import { attendanceMovedSql } from "@/lib/attendance-moved";
import { attendanceSummary } from "@/lib/attendance-rules";
import { attendanceStrip, bandLabel, type Band, type StripCell } from "@/lib/attainment-bands";
import { classDisplayName } from "@/lib/class-display";
import { onRosterSql } from "@/lib/class-roster-sql";
import { isHandedIn } from "@/lib/homework-rules";
import { enrolledInTermSql } from "@/lib/term-enrolment-sql";
import { getSubjectRatings } from "@/lib/term-report-ratings";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { weekNumberOn } from "@/lib/week-plan-rules";

/** The tutor's part of a subject's report (migration 0081). */
export type ReportEntry = {
  strengths: string;
  toWorkOn: string;
  goals: string;
  writtenBy: string | null;
  updatedAt: Date;
};

/** A 1 to 6 rating worked out from tests and major quizzes (`attainment-bands`). */
export type BandRating = { band: Band; label: string; score: number };

export type SubjectReport = {
  subjectId: string;
  subjectName: string;
  /** The tutors of the student's classes in this subject this term. */
  tutorNames: string[];
  /** Against everyone in the subject this term; null with no test or major quiz. */
  overall: BandRating | null;
  /** Each topic taught this term, in curriculum order. */
  topicRatings: { name: string; rating: BandRating | null }[];
  /** Every quiz and test result of the term, in week order. */
  results: { label: string; percent: number; kind: "test" | "quiz"; counts: boolean }[];
  attendance: { attended: number; total: number };
  /** Each class's lessons so far: attended, missed, made up, cancelled. */
  attendanceHistory: { classLabel: string; cells: StripCell[] }[];
  /** Homework set this term (not tests) and how much was handed in. */
  homework: { handedIn: number; set: number };
  /** The term's curriculum weeks that have started, in order. */
  covered: string[];
  entry: ReportEntry | null;
};

export type StudentTermReport = {
  student: { id: string; firstName: string; lastName: string; yearLevel: string | null; school: string | null };
  term: { id: string; year: number; termNumber: number; startDate: string; endDate: string };
  attendance: { present: number; total: number; percent: number | null };
  homework: { handedIn: number; set: number };
  subjects: SubjectReport[];
};

function rating(value: { band: Band; score: number } | undefined): BandRating | null {
  return value ? { band: value.band, label: bandLabel(value.band), score: Math.round(value.score) } : null;
}

/**
 * Assemble a student's term report: overall attendance and homework, and per
 * subject the 1 to 6 ratings overall and per topic (against everyone in the
 * subject), every quiz and test result, attendance with each class's
 * history, homework handed in, the curriculum covered, and the tutor's
 * strengths, things to work on and goals. The subjects are those of the
 * classes the student had during the term. Returns null if the student or
 * term doesn't exist. Caller is responsible for authorisation.
 */
export async function getStudentTermReport(
  studentId: string,
  termId: string,
): Promise<StudentTermReport | null> {
  const [student] = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      yearLevel: profiles.yearLevel,
      school: profiles.school,
    })
    .from(profiles)
    .where(eq(profiles.id, studentId))
    .limit(1);
  if (!student) return null;

  const [term] = await db
    .select({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .where(eq(terms.id, termId))
    .limit(1);
  if (!term) return null;

  const start = term.startDate;
  const end = term.endDate;
  const today = melbourneDate(new Date());
  const lastDay = today < end ? today : end;
  // homework.dueDate is a timestamp (Date), so it needs Date bounds rather than
  // the YYYY-MM-DD strings used for the `date`-typed lessons.date column.
  const startDt = new Date(`${start}T00:00:00`);
  const endExclusiveDt = new Date(`${end}T00:00:00`);
  endExclusiveDt.setDate(endExclusiveDt.getDate() + 1);

  // The classes the student had during the term, with their subjects and tutors.
  const tutor = alias(profiles, "class_tutor");
  const classRows = await db
    .selectDistinct({
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      tutorFirst: tutor.firstName,
      tutorLast: tutor.lastName,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutor, eq(tutor.id, classes.tutorId))
    .where(and(eq(enrollments.studentId, studentId), enrolledInTermSql(term)));
  const subjectIds = [...new Set(classRows.map((r) => r.subjectId))];
  const classIds = classRows.map((r) => r.classId);

  // Attendance across the term, overall and per subject. The shared rule:
  // late and left early count as attended, and a moved lesson is left out.
  const attnRows = await db
    .select({ status: attendance.status, moved: attendanceMovedSql, subjectId: classes.subjectId })
    .from(attendance)
    .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .where(and(eq(attendance.studentId, studentId), between(lessons.date, start, end)));
  const attn = attendanceSummary(attnRows);

  const [homeworkRows, weekRows, entryRows, lessonRows, makeupRows, ratingsBySubject] = await Promise.all([
    // Homework set this term (tests are rated separately), per subject.
    db
      .select({
        subjectId: sql<string | null>`coalesce(${classes.subjectId}, ${subjectWeeks.subjectId})`,
        status: homeworkAssignments.status,
      })
      .from(homeworkAssignments)
      .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
      .leftJoin(classes, eq(classes.id, homework.classId))
      .leftJoin(subjectWeeks, eq(subjectWeeks.id, homework.weekId))
      .where(
        and(
          eq(homeworkAssignments.studentId, studentId),
          eq(homework.isTest, false),
          gte(homework.dueDate, startDt),
          lt(homework.dueDate, endExclusiveDt),
        ),
      ),
    subjectIds.length
      ? db
          .select({ subjectId: subjectWeeks.subjectId, weekNumber: subjectWeeks.weekNumber, title: subjectWeeks.title })
          .from(subjectWeeks)
          .where(and(eq(subjectWeeks.termId, termId), inArray(subjectWeeks.subjectId, subjectIds)))
          .orderBy(subjectWeeks.weekNumber)
      : [],
    db
      .select({
        subjectId: termReportEntries.subjectId,
        strengths: termReportEntries.strengths,
        toWorkOn: termReportEntries.toWorkOn,
        goals: termReportEntries.goals,
        updatedAt: termReportEntries.updatedAt,
        writerFirst: profiles.firstName,
        writerLast: profiles.lastName,
      })
      .from(termReportEntries)
      .leftJoin(profiles, eq(profiles.id, termReportEntries.writtenBy))
      .where(and(eq(termReportEntries.studentId, studentId), eq(termReportEntries.termId, termId))),
    // Each class's lessons so far that the student was on the roll for (or
    // marked on), with their mark: the attendance history.
    classIds.length && lastDay >= start
      ? db
          .select({
            classId: lessons.classId,
            date: lessons.date,
            lessonStatus: lessons.status,
            mark: attendance.status,
          })
          .from(lessons)
          .leftJoin(attendance, and(eq(attendance.lessonId, lessons.id), eq(attendance.studentId, studentId)))
          .where(
            and(
              inArray(lessons.classId, classIds),
              gte(lessons.date, start),
              lte(lessons.date, lastDay),
              notInArray(lessons.status, ["makeup", "rescheduled"]),
              sql`(${attendance.studentId} is not null or exists (
                select 1 from enrollments e
                where e.class_id = lessons.class_id and e.student_id = ${studentId}
                  and ${onRosterSql("e", "lessons")}
              ))`,
            ),
          )
      : [],
    // Make-ups the student attended this term, by subject: a missed lesson
    // made up in the same week counts as made up.
    db
      .select({ subjectId: classes.subjectId, date: lessons.date })
      .from(attendance)
      .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .where(
        and(
          eq(attendance.studentId, studentId),
          eq(attendance.status, "makeup_attended"),
          between(lessons.date, start, end),
        ),
      ),
    Promise.all(subjectIds.map(async (id) => [id, await getSubjectRatings(id, term)] as const)).then(
      (pairs) => new Map(pairs),
    ),
  ]);
  const entryBySubject = new Map(entryRows.map((e) => [e.subjectId, e]));
  const weeksStarted = lastDay < start ? 0 : weekNumberOn(start, lastDay);

  const subjectReports: SubjectReport[] = subjectIds
    .map((subjectId) => {
      const own = classRows.filter((r) => r.subjectId === subjectId);
      const ratings = ratingsBySubject.get(subjectId)!;
      const subjectAttn = attendanceSummary(attnRows.filter((r) => r.subjectId === subjectId));
      const subjectHomework = homeworkRows.filter((h) => h.subjectId === subjectId);
      const makeupDates = makeupRows.filter((m) => m.subjectId === subjectId).map((m) => m.date);
      const entry = entryBySubject.get(subjectId);
      return {
        subjectId,
        subjectName: own[0].subjectName,
        tutorNames: [...new Set(own.map((r) => `${r.tutorFirst} ${r.tutorLast}`.trim()))],
        overall: rating(ratings.overall.get(studentId)),
        topicRatings: ratings.topics.map((t) => ({
          name: t.name,
          rating: rating(ratings.topicBands.get(t.id)?.get(studentId)),
        })),
        results: ratings.results
          .filter((r) => r.studentId === studentId)
          .sort((a, b) => (a.week ?? 99) - (b.week ?? 99) || a.label.localeCompare(b.label))
          .map(({ label, percent, kind, counts }) => ({ label, percent, kind, counts })),
        attendance: { attended: subjectAttn.attended, total: subjectAttn.total },
        attendanceHistory: [...new Map(own.map((r) => [r.classId, r])).values()].map((c) => ({
          classLabel: classDisplayName(c.subjectName, c.className),
          cells: attendanceStrip(
            lessonRows
              .filter((l) => l.classId === c.classId)
              .map((l) => ({ date: l.date, status: l.mark, cancelled: l.lessonStatus === "cancelled" })),
            makeupDates,
          ),
        })),
        homework: {
          handedIn: subjectHomework.filter((h) => isHandedIn(h.status)).length,
          set: subjectHomework.length,
        },
        covered: weekRows
          .filter((w) => w.subjectId === subjectId && w.weekNumber <= weeksStarted)
          .map((w) => w.title),
        entry: entry
          ? {
              strengths: entry.strengths,
              toWorkOn: entry.toWorkOn,
              goals: entry.goals,
              writtenBy: entry.writerFirst ? `${entry.writerFirst} ${entry.writerLast ?? ""}`.trim() : null,
              updatedAt: entry.updatedAt,
            }
          : null,
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  return {
    student,
    term,
    attendance: { present: attn.attended, total: attn.total, percent: attn.percent },
    homework: {
      handedIn: homeworkRows.filter((h) => isHandedIn(h.status)).length,
      set: homeworkRows.length,
    },
    subjects: subjectReports,
  };
}
