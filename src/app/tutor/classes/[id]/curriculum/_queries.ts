import "server-only";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  homework,
  homeworkAssignments,
  quizzes,
  resources,
  subjectTopics,
  subjectWeeks,
  subjects,
  terms,
} from "@/db/schema";
import { getClassWeekPlans } from "@/lib/week-plans";
import { weekNumberOn } from "@/lib/week-plan-rules";
import { resolveCurrentTerm, resolveMostRecentPastTerm } from "@/lib/curriculum";
import { LIVE_QUIZ_STATUSES } from "@/lib/quiz-status";
import { melbourneDate } from "@/lib/tutor-cover-rules";

export type TutorSectionAttachment = {
  id: string;
  kind: "file" | "link";
  fileName: string;
  storagePath: string | null;
  url: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  /** true if a live (non-removed) `resources` row already sources from this attachment */
  promoted: boolean;
};

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
  questionCount: number;
  /** This tutor was asked to write it (vs. a live quiz in their subject). */
  assignedToMe: boolean;
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
  note: string | null;               // "For students this week" for this class
  attachments: TutorSectionAttachment[];
  hasSection: boolean;               // note or ≥1 attachment
  homework: TutorWeekHomework[];
  quiz: TutorWeekQuiz | null;
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
  /** subject topics, for the "Add to library" promote form's topic select */
  topics: Array<{ id: string; name: string }>;
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

  const [plans, quizRows, hwRows] = await Promise.all([
    getClassWeekPlans(classId, weekIds),
    weekIds.length
      ? db
          .select({
            id: quizzes.id,
            title: quizzes.title,
            status: quizzes.status,
            note: quizzes.note,
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
  ]);

  const atts = [...plans.values()].flatMap((p) => p.attachments);
  const attIds = atts.map((a) => a.id);
  const promotedRows = attIds.length
    ? await db
        .select({ sourceAttachmentId: resources.sourceAttachmentId })
        .from(resources)
        .where(
          and(
            inArray(resources.sourceAttachmentId, attIds),
            isNull(resources.removedAt),
          ),
        )
    : [];
  const promotedAttachmentIds = new Set(
    promotedRows.map((r) => r.sourceAttachmentId),
  );

  const quizByWeek = new Map<string, TutorWeekQuiz>();
  for (const q of quizRows) {
    quizByWeek.set(q.subjectWeekId, {
      id: q.id,
      title: q.title,
      status: q.status,
      note: q.note,
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
    const plan = plans.get(tpl.id) ?? null;
    const attachments: TutorSectionAttachment[] = (plan?.attachments ?? []).map(
      (a) => ({
        id: a.id,
        kind: a.kind,
        fileName: a.fileName,
        storagePath: a.storagePath,
        url: a.url,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        promoted: promotedAttachmentIds.has(a.id),
      }),
    );
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
      note: plan?.body ?? null,
      attachments,
      hasSection: Boolean(plan?.body) || attachments.length > 0,
      homework: hwByWeek.get(tpl.id) ?? [],
      quiz: quizByWeek.get(tpl.id) ?? null,
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
    topics: topicRows,
  };
}
