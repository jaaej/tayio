import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes, homework, subjectWeeks, subjects, terms,
  tutorWeekSections, tutorWeekAttachments,
} from "@/db/schema";
import { resolveCurrentTerm, resolveMostRecentPastTerm } from "@/lib/curriculum";

export type TutorSectionAttachment = { id: string; fileName: string; storagePath: string };
export type TutorCurriculumWeek = {
  subjectWeekId: string;
  weekNumber: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  bookletUrl: string | null;
  note: string | null;               // the tutor's section note
  attachments: TutorSectionAttachment[];
  hasSection: boolean;               // note or ≥1 attachment
  homework: Array<{ id: string; title: string; dueDate: Date }>;
};

export type TutorCurriculumData = {
  className: string;
  subjectId: string;
  subjectName: string;
  currentTerm: { id: string; year: number; termNumber: number };
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: TutorCurriculumWeek[];
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
        fileName: tutorWeekAttachments.fileName,
        storagePath: tutorWeekAttachments.storagePath,
      }).from(tutorWeekAttachments).where(inArray(tutorWeekAttachments.sectionId, sectionIds))
    : [];
  const attBySection = new Map<string, TutorSectionAttachment[]>();
  for (const a of atts) {
    if (!attBySection.has(a.sectionId)) attBySection.set(a.sectionId, []);
    attBySection.get(a.sectionId)!.push({ id: a.id, fileName: a.fileName, storagePath: a.storagePath });
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
      videoUrl: tpl.videoUrl,
      bookletUrl: tpl.bookletUrl,
      note: s?.note ?? null,
      attachments,
      hasSection: Boolean(s?.note) || attachments.length > 0,
      homework: hwByWeek.get(tpl.id) ?? [],
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
  };
}
