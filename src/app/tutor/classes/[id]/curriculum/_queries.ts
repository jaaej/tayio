import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  classWeekOverrides,
  homework,
  subjectWeeks,
  subjects,
  terms,
} from "@/db/schema";
import {
  mergeOverride,
  resolveCurrentTerm,
  resolveMostRecentPastTerm,
  type MergedWeek,
} from "@/lib/curriculum";

export type TutorCurriculumWeek = MergedWeek & {
  templateTitle: string;
  templateDescription: string | null;
  templateVideoUrl: string | null;
  templateBookletUrl: string | null;
  overrideTitle: string | null;
  overrideDescription: string | null;
  overrideVideoUrl: string | null;
  overrideBookletUrl: string | null;
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

  const overrides =
    weekIds.length > 0
      ? await db
          .select()
          .from(classWeekOverrides)
          .where(
            and(
              eq(classWeekOverrides.classId, classId),
              inArray(classWeekOverrides.subjectWeekId, weekIds),
            ),
          )
      : [];
  const overrideByWeek = new Map(overrides.map((o) => [o.subjectWeekId, o]));

  const hwRows =
    weekIds.length > 0
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
    const o = overrideByWeek.get(tpl.id) ?? null;
    const merged = mergeOverride(tpl, o);
    return {
      ...merged,
      templateTitle: tpl.title,
      templateDescription: tpl.description,
      templateVideoUrl: tpl.videoUrl,
      templateBookletUrl: tpl.bookletUrl,
      overrideTitle: o?.title ?? null,
      overrideDescription: o?.description ?? null,
      overrideVideoUrl: o?.videoUrl ?? null,
      overrideBookletUrl: o?.bookletUrl ?? null,
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
