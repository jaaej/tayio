import "server-only";
import { and, asc, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  profiles,
  quizAttempts,
  quizzes,
  studentWeekProgress,
  subjectTopics,
  subjectWeeks,
  subjects,
  terms,
  classWeekPlanAttachments,
  classWeekPlans,
} from "@/db/schema";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { listApprovedQuizSummariesForWeeks } from "@/lib/quiz-queries";
import { LIVE_QUIZ_STATUSES } from "@/lib/quiz-status";
import { accessibleCurriculumTermsForStudent } from "@/lib/curriculum-access";
import {
  melbourneDateKey,
  releasedCurriculumWeek,
} from "@/lib/curriculum-access-rules";
import { curriculumWeekUnlockDate } from "../_lib/week-checklist";

export type StudentCurriculumWeek = {
  subjectWeekId: string;
  weekNumber: number;
  title: string;
  description: string | null;
  objectives: string | null;
  videoUrl: string | null;
  bookletUrl: string | null;
  topicId: string | null;
  topicName: string | null;
  tutorNote: string | null;
  /** When the tutor last saved the week's "For students this week" plan. */
  tutorNoteUpdatedAt: Date | null;
  tutorAttachments: Array<{
    id: string;
    kind: "file" | "link";
    fileName: string;
    url: string | null;
  }>;
  videoWatchedAt: Date | null;
  bookletOpenedAt: Date | null;
  homework: Array<{
    homeworkId: string;
    title: string;
    dueDate: Date;
    status: string;
    score: string | null;
  }>;
  quiz: {
    id: string;
    title: string;
    questionCount: number;
  } | null;
  /** The student's latest attempt at this week's quiz, if any. */
  quizAttempt: { correctCount: number; total: number } | null;
  /** A quiz was requested for this week but is not approved yet. */
  quizInProgress: boolean;
  locked: boolean;
  /** Melbourne date (YYYY-MM-DD) the week releases: term start + 7 days per week. */
  unlocksOn: string;
};

export type StudentCurriculumData = {
  subjectName: string;
  className: string;
  classId: string;
  /** The enrolled class's tutor, for "From {tutor}" and the message link. */
  tutorId: string;
  tutorName: string | null;
  currentTerm: {
    id: string;
    year: number;
    termNumber: number;
    startDate: string;
    endDate: string;
  };
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: StudentCurriculumWeek[];
  selectedWeekId: string | null;
};

export async function getStudentCurriculum(
  userId: string,
  subjectId: string,
  selectedTermId: string | undefined,
  selectedWeekId: string | undefined,
): Promise<StudentCurriculumData | null> {
  const [enrollment] = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      enrolledAt: enrollments.enrolledAt,
      tutorId: classes.tutorId,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .leftJoin(profiles, eq(profiles.id, classes.tutorId))
    .where(
      and(
        eq(enrollments.studentId, userId),
        eq(classes.subjectId, subjectId),
        isNull(enrollments.withdrawnAt),
      ),
    )
    .orderBy(asc(enrollments.enrolledAt))
    .limit(1);
  if (!enrollment) return null;

  const [firstEnrollment] = await db
    .select({ enrolledAt: enrollments.enrolledAt })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(
      and(
        eq(enrollments.studentId, userId),
        eq(classes.subjectId, subjectId),
      ),
    )
    .orderBy(asc(enrollments.enrolledAt))
    .limit(1);
  if (!firstEnrollment) return null;

  const termRows = await db
    .selectDistinct({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .innerJoin(subjectWeeks, eq(subjectWeeks.termId, terms.id))
    .where(eq(subjectWeeks.subjectId, subjectId))
    .orderBy(desc(terms.year), desc(terms.termNumber));
  if (termRows.length === 0) return null;

  const accessibleTerms = await accessibleCurriculumTermsForStudent({
    studentId: userId,
    subjectId,
    enrolledAt: firstEnrollment.enrolledAt,
    termRows,
  });
  if (accessibleTerms.length === 0) return null;

  const today = melbourneDateKey();
  const term =
    (selectedTermId && accessibleTerms.find((t) => t.id === selectedTermId)) ||
    accessibleTerms.find(
      (candidate) =>
        candidate.startDate <= today && today <= candidate.endDate,
    ) ||
    accessibleTerms[0];

  const templateWeeks = await db
    .select()
    .from(subjectWeeks)
    .where(
      and(
        eq(subjectWeeks.subjectId, subjectId),
        eq(subjectWeeks.termId, term.id),
      ),
    )
    .orderBy(asc(subjectWeeks.weekNumber));
  if (templateWeeks.length === 0) return null;

  const maxWeek = Math.max(...templateWeeks.map((week) => week.weekNumber));
  const releasedThroughWeek = releasedCurriculumWeek(term, maxWeek, today);
  const weekIds = templateWeeks
    .filter((week) => week.weekNumber <= releasedThroughWeek)
    .map((week) => week.id);
  const quizRows = await listApprovedQuizSummariesForWeeks(weekIds);
  const quizByWeek = new Map(
    quizRows.map((quiz) => [quiz.subjectWeekId, quiz]),
  );
  const quizIds = quizRows.map((quiz) => quiz.id);
  const pendingQuizWeeks = new Set(
    weekIds.length
      ? (
          await db
            .select({ subjectWeekId: quizzes.subjectWeekId })
            .from(quizzes)
            .where(
              and(
                inArray(quizzes.subjectWeekId, weekIds),
                notInArray(quizzes.status, [...LIVE_QUIZ_STATUSES]),
              ),
            )
        ).map((row) => row.subjectWeekId)
      : [],
  );
  const attemptRows = quizIds.length
    ? await db
        .select({
          quizId: quizAttempts.quizId,
          correctCount: quizAttempts.correctCount,
          total: quizAttempts.total,
          submittedAt: quizAttempts.submittedAt,
        })
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.studentId, userId),
            inArray(quizAttempts.quizId, quizIds),
          ),
        )
    : [];
  const latestAttempt = new Map<string, (typeof attemptRows)[number]>();
  for (const attempt of attemptRows) {
    const prev = latestAttempt.get(attempt.quizId);
    if (!prev || attempt.submittedAt > prev.submittedAt) {
      latestAttempt.set(attempt.quizId, attempt);
    }
  }
  const attemptFor = (quizId: string | undefined) => {
    const attempt = quizId ? latestAttempt.get(quizId) : undefined;
    return attempt
      ? { correctCount: attempt.correctCount, total: attempt.total }
      : null;
  };

  // Topic names for this subject
  const topicRows = await db
    .select({ id: subjectTopics.id, name: subjectTopics.name })
    .from(subjectTopics)
    .where(eq(subjectTopics.subjectId, subjectId));
  const topicName = new Map(topicRows.map((t) => [t.id, t.name]));

  // Tutor sections + attachments for the enrolled class's tutor
  const sections = weekIds.length
    ? await db
        .select()
        .from(classWeekPlans)
        .where(
          and(
            eq(classWeekPlans.classId, enrollment.classId),
            inArray(classWeekPlans.subjectWeekId, weekIds),
          ),
        )
    : [];
  const sectionByWeek = new Map(sections.map((s) => [s.subjectWeekId, s]));
  const sectionIds = sections.map((s) => s.id);
  const attRows = sectionIds.length
    ? await db
        .select()
        .from(classWeekPlanAttachments)
        .where(inArray(classWeekPlanAttachments.planId, sectionIds))
    : [];
  // Group attachments by sectionId for fast lookup
  const attsBySection = new Map<string, typeof attRows>();
  for (const a of attRows) {
    if (!attsBySection.has(a.planId)) attsBySection.set(a.planId, []);
    attsBySection.get(a.planId)!.push(a);
  }

  const progress = weekIds.length
    ? await db
        .select()
        .from(studentWeekProgress)
        .where(
          and(
            eq(studentWeekProgress.studentId, userId),
            inArray(studentWeekProgress.subjectWeekId, weekIds),
          ),
        )
    : [];
  const progressByWeek = new Map(progress.map((p) => [p.subjectWeekId, p]));

  const hwRows = weekIds.length
    ? await db
        .select({
          homeworkId: homework.id,
          title: homework.title,
          dueDate: homework.dueDate,
          weekId: homework.weekId,
          status: homeworkAssignments.status,
          score: homeworkAssignments.score,
        })
        .from(homework)
        .innerJoin(
          homeworkAssignments,
          and(
            eq(homeworkAssignments.homeworkId, homework.id),
            eq(homeworkAssignments.studentId, userId),
          ),
        )
        .where(inArray(homework.weekId, weekIds))
    : [];
  const hwByWeek = new Map<string, typeof hwRows>();
  for (const r of hwRows) {
    if (!r.weekId) continue;
    if (!hwByWeek.has(r.weekId)) hwByWeek.set(r.weekId, []);
    hwByWeek.get(r.weekId)!.push(r);
  }

  const weeks: StudentCurriculumWeek[] = await Promise.all(
    templateWeeks.map(async (tpl) => {
      const locked = tpl.weekNumber > releasedThroughWeek;
      const unlocksOn = curriculumWeekUnlockDate(term.startDate, tpl.weekNumber);
      if (locked) {
        return {
          subjectWeekId: tpl.id,
          weekNumber: tpl.weekNumber,
          title: tpl.title,
          description: null,
          objectives: null,
          videoUrl: null,
          bookletUrl: null,
          topicId: tpl.topicId,
          topicName: tpl.topicId ? (topicName.get(tpl.topicId) ?? null) : null,
          tutorNote: null,
          tutorNoteUpdatedAt: null,
          tutorAttachments: [],
          videoWatchedAt: null,
          bookletOpenedAt: null,
          homework: [],
          quiz: null,
          quizAttempt: null,
          quizInProgress: false,
          locked: true,
          unlocksOn,
        } satisfies StudentCurriculumWeek;
      }
      const p = progressByWeek.get(tpl.id);
      const section = sectionByWeek.get(tpl.id);
      const sectionAtts = section
        ? (attsBySection.get(section.id) ?? [])
        : [];
      const tutorAttachments = await Promise.all(
        sectionAtts.map(async (a) => ({
          id: a.id,
          kind: a.kind === "link" ? ("link" as const) : ("file" as const),
          fileName: a.fileName,
          url: a.kind === "link" ? a.url : await signCurriculumUrl(a.storagePath),
        })),
      );
      return {
        subjectWeekId: tpl.id,
        weekNumber: tpl.weekNumber,
        title: tpl.title,
        description: tpl.description,
        objectives: tpl.objectives,
        videoUrl: tpl.videoUrl,
        bookletUrl: tpl.bookletUrl,
        topicId: tpl.topicId,
        topicName: tpl.topicId ? (topicName.get(tpl.topicId) ?? null) : null,
        tutorNote: section?.body ?? null,
        tutorNoteUpdatedAt: section?.updatedAt ?? null,
        tutorAttachments,
        videoWatchedAt: p?.videoWatchedAt ?? null,
        bookletOpenedAt: p?.bookletOpenedAt ?? null,
        homework: (hwByWeek.get(tpl.id) ?? []).map((h) => ({
          homeworkId: h.homeworkId,
          title: h.title,
          dueDate: h.dueDate,
          status: h.status,
          score: h.score,
        })),
        quiz: quizByWeek.get(tpl.id) ?? null,
        quizAttempt: attemptFor(quizByWeek.get(tpl.id)?.id),
        quizInProgress: pendingQuizWeeks.has(tpl.id),
        locked: false,
        unlocksOn,
      };
    }),
  );

  return {
    subjectName: enrollment.subjectName,
    className: enrollment.className,
    classId: enrollment.classId,
    tutorId: enrollment.tutorId,
    tutorName:
      [enrollment.tutorFirstName, enrollment.tutorLastName]
        .filter(Boolean)
        .join(" ")
        .trim() || null,
    currentTerm: {
      id: term.id,
      year: term.year,
      termNumber: term.termNumber,
      startDate: term.startDate,
      endDate: term.endDate,
    },
    termsAvailable: accessibleTerms.map((t) => ({
      id: t.id,
      year: t.year,
      termNumber: t.termNumber,
    })),
    weeks,
    selectedWeekId:
      (selectedWeekId &&
        weeks.find(
          (w) => w.subjectWeekId === selectedWeekId && !w.locked,
        )
          ?.subjectWeekId) ??
      null,
  };
}
