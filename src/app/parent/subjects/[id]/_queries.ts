import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  classWeekOverrides,
  enrollments,
  familyLinks,
  homework,
  homeworkAssignments,
  profiles,
  studentWeekProgress,
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

export type ParentCurriculumWeek = MergedWeek & {
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

  const overrides = await db
    .select()
    .from(classWeekOverrides)
    .where(
      and(
        eq(classWeekOverrides.classId, enr.classId),
        inArray(classWeekOverrides.subjectWeekId, weekIds),
      ),
    );
  const overrideByWeek = new Map(overrides.map((o) => [o.subjectWeekId, o]));

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

  const weeks: ParentCurriculumWeek[] = templates.map((tpl) => {
    const merged = mergeOverride(tpl, overrideByWeek.get(tpl.id) ?? null);
    const p = progressByWeek.get(tpl.id);
    return {
      ...merged,
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
  });

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
