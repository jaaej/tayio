import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  studentWeekProgress,
  subjectTopics,
  subjectWeeks,
  subjects,
  terms,
  tutorWeekAttachments,
  tutorWeekSections,
} from "@/db/schema";
import {
  resolveCurrentTerm,
  resolveMostRecentPastTerm,
} from "@/lib/curriculum";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { listApprovedQuizSummariesForWeeks } from "@/lib/quiz-queries";

export type StudentCurriculumWeek = {
  subjectWeekId: string;
  weekNumber: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  bookletUrl: string | null;
  topicId: string | null;
  topicName: string | null;
  tutorNote: string | null;
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
};

export type StudentCurriculumData = {
  subjectName: string;
  className: string;
  classId: string;
  lessonPlan: string | null;
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
      tutorId: classes.tutorId,
      lessonPlan: classes.lessonPlan,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(enrollments.studentId, userId),
        eq(classes.subjectId, subjectId),
      ),
    )
    .orderBy(asc(enrollments.enrolledAt))
    .limit(1);
  if (!enrollment) return null;

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

  let term =
    (selectedTermId && termRows.find((t) => t.id === selectedTermId)) ||
    (await resolveCurrentTerm()) ||
    (await resolveMostRecentPastTerm()) ||
    termRows[0];
  if (!termRows.find((t) => t.id === term.id)) term = termRows[0];

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

  const weekIds = templateWeeks.map((w) => w.id);
  const quizRows = await listApprovedQuizSummariesForWeeks(weekIds);
  const quizByWeek = new Map(
    quizRows.map((quiz) => [quiz.subjectWeekId, quiz]),
  );

  // Topic names for this subject
  const topicRows = await db
    .select({ id: subjectTopics.id, name: subjectTopics.name })
    .from(subjectTopics)
    .where(eq(subjectTopics.subjectId, subjectId));
  const topicName = new Map(topicRows.map((t) => [t.id, t.name]));

  // Tutor sections + attachments for the enrolled class's tutor
  const sections = await db
    .select()
    .from(tutorWeekSections)
    .where(
      and(
        eq(tutorWeekSections.tutorId, enrollment.tutorId),
        inArray(tutorWeekSections.subjectWeekId, weekIds),
      ),
    );
  const sectionByWeek = new Map(sections.map((s) => [s.subjectWeekId, s]));
  const sectionIds = sections.map((s) => s.id);
  const attRows = sectionIds.length
    ? await db
        .select()
        .from(tutorWeekAttachments)
        .where(inArray(tutorWeekAttachments.sectionId, sectionIds))
    : [];
  // Group attachments by sectionId for fast lookup
  const attsBySection = new Map<string, typeof attRows>();
  for (const a of attRows) {
    if (!attsBySection.has(a.sectionId)) attsBySection.set(a.sectionId, []);
    attsBySection.get(a.sectionId)!.push(a);
  }

  const progress = await db
    .select()
    .from(studentWeekProgress)
    .where(
      and(
        eq(studentWeekProgress.studentId, userId),
        inArray(studentWeekProgress.subjectWeekId, weekIds),
      ),
    );
  const progressByWeek = new Map(progress.map((p) => [p.subjectWeekId, p]));

  const hwRows = await db
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
    .where(inArray(homework.weekId, weekIds));
  const hwByWeek = new Map<string, typeof hwRows>();
  for (const r of hwRows) {
    if (!r.weekId) continue;
    if (!hwByWeek.has(r.weekId)) hwByWeek.set(r.weekId, []);
    hwByWeek.get(r.weekId)!.push(r);
  }

  const weeks: StudentCurriculumWeek[] = await Promise.all(
    templateWeeks.map(async (tpl) => {
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
        videoUrl: tpl.videoUrl,
        bookletUrl: tpl.bookletUrl,
        topicId: tpl.topicId,
        topicName: tpl.topicId ? (topicName.get(tpl.topicId) ?? null) : null,
        tutorNote: section?.note ?? null,
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
      };
    }),
  );

  return {
    subjectName: enrollment.subjectName,
    className: enrollment.className,
    classId: enrollment.classId,
    lessonPlan: enrollment.lessonPlan,
    currentTerm: {
      id: term.id,
      year: term.year,
      termNumber: term.termNumber,
      startDate: term.startDate,
      endDate: term.endDate,
    },
    termsAvailable: termRows.map((t) => ({
      id: t.id,
      year: t.year,
      termNumber: t.termNumber,
    })),
    weeks,
    selectedWeekId:
      (selectedWeekId &&
        weeks.find((w) => w.subjectWeekId === selectedWeekId)
          ?.subjectWeekId) ??
      null,
  };
}
