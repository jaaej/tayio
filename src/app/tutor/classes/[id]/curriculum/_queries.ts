import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  homework,
  homeworkAssignments,
  lessons,
  quizzes,
  subjectTopics,
  subjectWeeks,
  subjects,
  terms,
} from "@/db/schema";
import { weekNumberOn } from "@/lib/week-plan-rules";
import { resolveCurrentTerm, resolveMostRecentPastTerm } from "@/lib/curriculum";
import { LIVE_QUIZ_STATUSES } from "@/lib/quiz-status";
import { LESSON_OFF_STATUSES } from "@/lib/lesson-progress-sql";
import { melbourneDate } from "@/lib/tutor-cover-rules";

export type TutorWeekHomework = {
  id: string;
  title: string;
  dueDate: Date;
  isTest: boolean;
  assigned: number;
  /** Handed in (submitted, late, marked or returned). */
  handedIn: number;
  /** Handed in and waiting for marking. */
  toMark: number;
};

export type TutorWeekQuiz = {
  id: string;
  title: string;
  status: string;
  note: string | null;
  reviewNote: string | null;
  reviewNoteAt: Date | null;
  questionCount: number;
  /** This tutor was asked to write it (vs. a live quiz in their subject). */
  assignedToMe: boolean;
};

/** This class's lesson in the week, for its recording link. */
export type TutorWeekLesson = {
  id: string;
  date: string;
  recordingUrl: string | null;
  /** This tutor teaches it (a covered lesson's page is the cover tutor's). */
  mine: boolean;
};

export type TutorCurriculumWeek = {
  subjectWeekId: string;
  weekNumber: number;
  title: string;
  description: string | null;
  objectives: string | null;
  topicId: string | null;
  topicName: string | null;
  videoUrl: string | null;
  bookletUrl: string | null;
  homework: TutorWeekHomework[];
  quiz: TutorWeekQuiz | null;
  /** The class's first lesson in the week, if it has one. */
  lesson: TutorWeekLesson | null;
};

export type TutorCurriculumData = {
  className: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  currentTerm: { id: string; year: number; termNumber: number };
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: TutorCurriculumWeek[];
  /** The week today falls in, when the shown term is the running one. */
  currentWeekId: string | null;
};

export async function getTutorCurriculum(
  tutorId: string,
  classId: string,
  selectedTermId: string | undefined,
  /** The `?week=` being opened: without a term, its own term is shown. */
  linkedWeekId?: string,
): Promise<TutorCurriculumData | null> {
  const [cls] = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectColor: subjects.color,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(and(eq(classes.id, classId), eq(classes.tutorId, tutorId)))
    .limit(1);
  if (!cls) return null;

  const allTerms = await db
    .select({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.termNumber));

  const [linkedWeek] =
    !selectedTermId && linkedWeekId && /^[0-9a-f-]{36}$/i.test(linkedWeekId)
      ? await db
          .select({ termId: subjectWeeks.termId })
          .from(subjectWeeks)
          .where(
            and(
              eq(subjectWeeks.id, linkedWeekId),
              eq(subjectWeeks.subjectId, cls.subjectId),
            ),
          )
          .limit(1)
      : [];
  const term =
    (selectedTermId && allTerms.find((t) => t.id === selectedTermId)) ||
    (linkedWeek && allTerms.find((t) => t.id === linkedWeek.termId)) ||
    (await resolveCurrentTerm()) ||
    (await resolveMostRecentPastTerm()) ||
    allTerms[0];
  if (!term) return null;

  const templates = await db
    .select()
    .from(subjectWeeks)
    .where(
      and(
        eq(subjectWeeks.subjectId, cls.subjectId),
        eq(subjectWeeks.termId, term.id),
      ),
    )
    .orderBy(asc(subjectWeeks.weekNumber));
  const weekIds = templates.map((t) => t.id);

  const topicRows = await db
    .select({ id: subjectTopics.id, name: subjectTopics.name })
    .from(subjectTopics)
    .where(eq(subjectTopics.subjectId, cls.subjectId));
  const topicName = new Map(topicRows.map((t) => [t.id, t.name]));

  const [quizRows, hwRows, lessonRows] = await Promise.all([
    weekIds.length
      ? db
          .select({
            id: quizzes.id,
            title: quizzes.title,
            status: quizzes.status,
            note: quizzes.note,
            reviewNote: quizzes.reviewNote,
            reviewNoteAt: quizzes.reviewNoteAt,
            subjectWeekId: quizzes.subjectWeekId,
            assignedTutorId: quizzes.assignedTutorId,
            // Table names spelled out: in a single-table select Drizzle drops
            // the prefix, and "quiz_id" = "id" would match the inner table.
            questionCount: sql<number>`(
              select count(*)::int from quiz_questions qq
              where qq.quiz_id = quizzes.id and qq.type <> 'context'
            )`,
          })
          .from(quizzes)
          .where(
            and(
              inArray(quizzes.subjectWeekId, weekIds),
              // Same visibility as the tutor quiz list: live quizzes in the
              // subject, or one this tutor was asked to write.
              or(
                inArray(quizzes.status, [...LIVE_QUIZ_STATUSES]),
                eq(quizzes.assignedTutorId, tutorId),
              ),
            ),
          )
      : Promise.resolve([]),
    weekIds.length
      ? db
          .select({
            id: homework.id,
            title: homework.title,
            dueDate: homework.dueDate,
            isTest: homework.isTest,
            weekId: homework.weekId,
            assigned: sql<number>`count(${homeworkAssignments.studentId})::int`,
            handedIn: sql<number>`count(*) filter (where ${homeworkAssignments.status} in ('submitted', 'late', 'marked', 'returned'))::int`,
            toMark: sql<number>`count(*) filter (where ${homeworkAssignments.status} in ('submitted', 'late'))::int`,
          })
          .from(homework)
          .leftJoin(
            homeworkAssignments,
            eq(homeworkAssignments.homeworkId, homework.id),
          )
          .where(
            and(
              eq(homework.classId, classId),
              inArray(homework.weekId, weekIds),
            ),
          )
          .groupBy(homework.id)
          .orderBy(asc(homework.dueDate))
      : Promise.resolve([]),
    // The class's own lessons in the term (not make-ups, nothing that did
    // not run), matched to weeks the way getLessonWeek does.
    db
      .select({
        id: lessons.id,
        date: lessons.date,
        recordingUrl: lessons.recordingUrl,
        tutorId: lessons.tutorId,
      })
      .from(lessons)
      .where(
        and(
          eq(lessons.classId, classId),
          gte(lessons.date, term.startDate),
          lte(lessons.date, term.endDate),
          notInArray(lessons.status, ["makeup", ...LESSON_OFF_STATUSES]),
        ),
      )
      .orderBy(asc(lessons.date), asc(lessons.startTime)),
  ]);
  const lessonByWeek = new Map<number, TutorWeekLesson>();
  for (const l of lessonRows) {
    const week = weekNumberOn(term.startDate, l.date);
    if (lessonByWeek.has(week)) continue;
    lessonByWeek.set(week, {
      id: l.id,
      date: l.date,
      recordingUrl: l.recordingUrl,
      mine: l.tutorId === tutorId,
    });
  }

  const quizByWeek = new Map<string, TutorWeekQuiz>();
  for (const q of quizRows) {
    quizByWeek.set(q.subjectWeekId, {
      id: q.id,
      title: q.title,
      status: q.status,
      note: q.note,
      reviewNote: q.reviewNote,
      reviewNoteAt: q.reviewNoteAt,
      questionCount: q.questionCount,
      assignedToMe: q.assignedTutorId === tutorId,
    });
  }

  const hwByWeek = new Map<string, TutorWeekHomework[]>();
  for (const r of hwRows) {
    if (!r.weekId) continue;
    if (!hwByWeek.has(r.weekId)) hwByWeek.set(r.weekId, []);
    hwByWeek.get(r.weekId)!.push({
      id: r.id,
      title: r.title,
      dueDate: r.dueDate,
      isTest: r.isTest,
      assigned: r.assigned,
      handedIn: r.handedIn,
      toMark: r.toMark,
    });
  }

  const weeks: TutorCurriculumWeek[] = templates.map((tpl) => {
    return {
      subjectWeekId: tpl.id,
      weekNumber: tpl.weekNumber,
      title: tpl.title,
      description: tpl.description,
      objectives: tpl.objectives,
      topicId: tpl.topicId,
      topicName: tpl.topicId ? (topicName.get(tpl.topicId) ?? null) : null,
      videoUrl: tpl.videoUrl,
      bookletUrl: tpl.bookletUrl,
      homework: hwByWeek.get(tpl.id) ?? [],
      quiz: quizByWeek.get(tpl.id) ?? null,
      lesson: lessonByWeek.get(tpl.weekNumber) ?? null,
    };
  });

  const today = melbourneDate();
  const running = term.startDate <= today && today <= term.endDate;
  const todayWeek = running ? weekNumberOn(term.startDate, today) : null;
  const currentWeekId =
    weeks.find((w) => w.weekNumber === todayWeek)?.subjectWeekId ?? null;

  return {
    className: cls.className,
    subjectId: cls.subjectId,
    subjectName: cls.subjectName,
    subjectColor: cls.subjectColor,
    currentTerm: {
      id: term.id,
      year: term.year,
      termNumber: term.termNumber,
    },
    termsAvailable: allTerms.map((t) => ({
      id: t.id,
      year: t.year,
      termNumber: t.termNumber,
    })),
    weeks,
    currentWeekId,
  };
}
