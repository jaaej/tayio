import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  familyLinks,
  homework,
  homeworkAssignments,
  profiles,
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

export type ParentCurriculumWeek = {
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
};

export type ParentCurriculumData = {
  childFirstName: string;
  subjectName: string;
  className: string;
  classId: string;
  currentTerm: {
    id: string;
    year: number;
    termNumber: number;
    startDate: string;
    endDate: string;
  };
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: ParentCurriculumWeek[];
};

export async function getParentCurriculum(
  parentId: string,
  childId: string,
  subjectId: string,
  selectedTermId: string | undefined,
): Promise<ParentCurriculumData | null> {
  const [link] = await db
    .select({ studentId: familyLinks.studentId })
    .from(familyLinks)
    .where(
      and(
        eq(familyLinks.parentId, parentId),
        eq(familyLinks.studentId, childId),
      ),
    )
    .limit(1);
  if (!link) return null;

  const [enr] = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      tutorId: classes.tutorId,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(eq(enrollments.studentId, childId), eq(classes.subjectId, subjectId)),
    )
    .orderBy(asc(enrollments.enrolledAt))
    .limit(1);
  if (!enr) return null;

  const [child] = await db
    .select({ firstName: profiles.firstName })
    .from(profiles)
    .where(eq(profiles.id, childId))
    .limit(1);

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

  const templates = await db
    .select()
    .from(subjectWeeks)
    .where(
      and(
        eq(subjectWeeks.subjectId, subjectId),
        eq(subjectWeeks.termId, term.id),
      ),
    )
    .orderBy(asc(subjectWeeks.weekNumber));
  if (templates.length === 0) return null;
  const weekIds = templates.map((w) => w.id);

  // Topic names for this subject
  const topicRows = await db
    .select({ id: subjectTopics.id, name: subjectTopics.name })
    .from(subjectTopics)
    .where(eq(subjectTopics.subjectId, subjectId));
  const topicName = new Map(topicRows.map((t) => [t.id, t.name]));

  // Tutor sections + attachments for the child's class tutor
  const sections = await db
    .select()
    .from(tutorWeekSections)
    .where(
      and(
        eq(tutorWeekSections.tutorId, enr.tutorId),
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
        eq(studentWeekProgress.studentId, childId),
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
        eq(homeworkAssignments.studentId, childId),
      ),
    )
    .where(inArray(homework.weekId, weekIds));
  const hwByWeek = new Map<string, typeof hwRows>();
  for (const r of hwRows) {
    if (!r.weekId) continue;
    if (!hwByWeek.has(r.weekId)) hwByWeek.set(r.weekId, []);
    hwByWeek.get(r.weekId)!.push(r);
  }

  const weeks: ParentCurriculumWeek[] = await Promise.all(
    templates.map(async (tpl) => {
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
      };
    }),
  );

  return {
    childFirstName: child?.firstName ?? "",
    subjectName: enr.subjectName,
    className: enr.className,
    classId: enr.classId,
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
  };
}
