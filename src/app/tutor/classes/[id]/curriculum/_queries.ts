import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes, homework, quizzes, resources, subjectTopics, subjectWeeks, subjects, terms,
  tutorWeekSections, tutorWeekAttachments,
} from "@/db/schema";
import { resolveCurrentTerm, resolveMostRecentPastTerm } from "@/lib/curriculum";
import { listApprovedQuizSummariesForWeeks } from "@/lib/quiz-queries";

export type TutorSectionAttachment = {
  id: string;
  kind: "file" | "link";
  fileName: string;
  storagePath: string | null;
  url: string | null;
  /** true if a live (non-removed) `resources` row already sources from this attachment */
  promoted: boolean;
};
export type TutorCurriculumWeek = {
  subjectWeekId: string;
  weekNumber: number;
  title: string;
  description: string | null;
  topicId: string | null;
  topicName: string | null;
  videoUrl: string | null;
  bookletUrl: string | null;
  note: string | null;               // the tutor's section note
  attachments: TutorSectionAttachment[];
  hasSection: boolean;               // note or ≥1 attachment
  homework: Array<{ id: string; title: string; dueDate: Date }>;
  quiz: {
    id: string;
    title: string;
    questionCount: number;
  } | null;
  /** A quiz an admin has REQUESTED from this tutor for this week (editable now). */
  editableQuiz: { id: string; status: string } | null;
};

export type TutorCurriculumData = {
  className: string;
  subjectId: string;
  subjectName: string;
  currentTerm: { id: string; year: number; termNumber: number };
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: TutorCurriculumWeek[];
  /** subject topics, for the "Also publish to library" promote form's topic select */
  topics: Array<{ id: string; name: string }>;
};

export async function getTutorCurriculum(
  tutorId: string,
  classId: string,
  selectedTermId: string | undefined,
): Promise<TutorCurriculumData | null> {
  const [cls] = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
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
    })
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.termNumber));

  const term =
    (selectedTermId && allTerms.find((t) => t.id === selectedTermId)) ||
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
  const quizRows = await listApprovedQuizSummariesForWeeks(weekIds);
  const quizByWeek = new Map(
    quizRows.map((quiz) => [quiz.subjectWeekId, quiz]),
  );

  // Quizzes an admin has requested from THIS tutor for these weeks - the only
  // ones the tutor may edit. Approved quizzes above are view-only for the tutor.
  const editableQuizRows = weekIds.length
    ? await db
        .select({
          id: quizzes.id,
          subjectWeekId: quizzes.subjectWeekId,
          status: quizzes.status,
        })
        .from(quizzes)
        .where(
          and(
            inArray(quizzes.subjectWeekId, weekIds),
            eq(quizzes.assignedTutorId, tutorId),
            inArray(quizzes.status, ["requested", "changes_requested"]),
          ),
        )
    : [];
  const editableQuizByWeek = new Map(
    editableQuizRows.map((q) => [
      q.subjectWeekId,
      { id: q.id, status: q.status as string },
    ]),
  );

  const topicRows = await db
    .select({ id: subjectTopics.id, name: subjectTopics.name })
    .from(subjectTopics)
    .where(eq(subjectTopics.subjectId, cls.subjectId));
  const topicName = new Map(topicRows.map((t) => [t.id, t.name]));

  const sections = weekIds.length
    ? await db.select().from(tutorWeekSections).where(and(
        eq(tutorWeekSections.tutorId, tutorId),
        inArray(tutorWeekSections.subjectWeekId, weekIds),
      ))
    : [];
  const sectionByWeek = new Map(sections.map((s) => [s.subjectWeekId, s]));
  const sectionIds = sections.map((s) => s.id);
  const atts = sectionIds.length
    ? await db.select({
        id: tutorWeekAttachments.id,
        sectionId: tutorWeekAttachments.sectionId,
        kind: tutorWeekAttachments.kind,
        fileName: tutorWeekAttachments.fileName,
        storagePath: tutorWeekAttachments.storagePath,
        url: tutorWeekAttachments.url,
      }).from(tutorWeekAttachments).where(inArray(tutorWeekAttachments.sectionId, sectionIds))
    : [];

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

  const attBySection = new Map<string, TutorSectionAttachment[]>();
  for (const a of atts) {
    if (!attBySection.has(a.sectionId)) attBySection.set(a.sectionId, []);
    attBySection.get(a.sectionId)!.push({
      id: a.id,
      kind: a.kind === "link" ? "link" : "file",
      fileName: a.fileName,
      storagePath: a.storagePath,
      url: a.url,
      promoted: promotedAttachmentIds.has(a.id),
    });
  }

  const hwRows = weekIds.length
    ? await db
        .select({
          id: homework.id,
          title: homework.title,
          dueDate: homework.dueDate,
          weekId: homework.weekId,
        })
        .from(homework)
        .where(
          and(
            eq(homework.classId, classId),
            inArray(homework.weekId, weekIds),
          ),
        )
        .orderBy(asc(homework.dueDate))
    : [];
  const hwByWeek = new Map<string, Array<{ id: string; title: string; dueDate: Date }>>();
  for (const r of hwRows) {
    if (!r.weekId) continue;
    if (!hwByWeek.has(r.weekId)) hwByWeek.set(r.weekId, []);
    hwByWeek.get(r.weekId)!.push({ id: r.id, title: r.title, dueDate: r.dueDate });
  }

  const weeks: TutorCurriculumWeek[] = templates.map((tpl) => {
    const s = sectionByWeek.get(tpl.id) ?? null;
    const attachments = s ? (attBySection.get(s.id) ?? []) : [];
    return {
      subjectWeekId: tpl.id,
      weekNumber: tpl.weekNumber,
      title: tpl.title,
      description: tpl.description,
      topicId: tpl.topicId,
      topicName: tpl.topicId ? (topicName.get(tpl.topicId) ?? null) : null,
      videoUrl: tpl.videoUrl,
      bookletUrl: tpl.bookletUrl,
      note: s?.note ?? null,
      attachments,
      hasSection: Boolean(s?.note) || attachments.length > 0,
      homework: hwByWeek.get(tpl.id) ?? [],
      quiz: quizByWeek.get(tpl.id) ?? null,
      editableQuiz: editableQuizByWeek.get(tpl.id) ?? null,
    };
  });

  return {
    className: cls.className,
    subjectId: cls.subjectId,
    subjectName: cls.subjectName,
    currentTerm: {
      id: term.id,
      year: term.year,
      termNumber: term.termNumber,
    },
    termsAvailable: allTerms,
    weeks,
    topics: topicRows,
  };
}
