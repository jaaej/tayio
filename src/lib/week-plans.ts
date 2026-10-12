import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  classWeekPlanAttachments,
  classWeekPlans,
  subjectWeeks,
  terms,
} from "@/db/schema";
import { weekNumberOn } from "@/lib/week-plan-rules";

// "For students this week": one field per class per curriculum week (migration
// 0060). Read here so the tutor Week plan tab, the tutor lesson page and the
// student/parent week views all resolve it the same way.

export type WeekPlanAttachment = {
  id: string;
  kind: "file" | "link";
  fileName: string;
  storagePath: string | null;
  url: string | null;
  contentType: string | null;
  sizeBytes: number | null;
};

export type WeekPlan = {
  id: string;
  subjectWeekId: string;
  body: string | null;
  updatedAt: Date;
  attachments: WeekPlanAttachment[];
};

/** Week plans for one class, keyed by subject week id. */
export async function getClassWeekPlans(
  classId: string,
  subjectWeekIds: string[],
): Promise<Map<string, WeekPlan>> {
  const out = new Map<string, WeekPlan>();
  if (subjectWeekIds.length === 0) return out;
  const plans = await db
    .select({
      id: classWeekPlans.id,
      subjectWeekId: classWeekPlans.subjectWeekId,
      body: classWeekPlans.body,
      updatedAt: classWeekPlans.updatedAt,
    })
    .from(classWeekPlans)
    .where(
      and(
        eq(classWeekPlans.classId, classId),
        inArray(classWeekPlans.subjectWeekId, subjectWeekIds),
      ),
    );
  if (plans.length === 0) return out;
  const atts = await db
    .select()
    .from(classWeekPlanAttachments)
    .where(
      inArray(
        classWeekPlanAttachments.planId,
        plans.map((p) => p.id),
      ),
    )
    .orderBy(asc(classWeekPlanAttachments.uploadedAt));
  for (const p of plans) {
    out.set(p.subjectWeekId, {
      ...p,
      attachments: atts
        .filter((a) => a.planId === p.id)
        .map((a) => ({
          id: a.id,
          kind: a.kind === "link" ? "link" : "file",
          fileName: a.fileName,
          storagePath: a.storagePath,
          url: a.url,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
        })),
    });
  }
  return out;
}

export type LessonWeek = {
  subjectWeekId: string;
  termId: string;
  weekNumber: number;
  title: string;
  plan: WeekPlan | null;
};

/**
 * The curriculum week a lesson on `isoDate` falls in, for that class's
 * subject, with its week plan. Null when the date is outside every term or the
 * subject has no week for it.
 */
export async function getLessonWeek(
  classId: string,
  isoDate: string,
): Promise<LessonWeek | null> {
  const [row] = await db
    .select({
      subjectId: classes.subjectId,
      termId: terms.id,
      termStart: terms.startDate,
    })
    .from(classes)
    .innerJoin(
      terms,
      and(lte(terms.startDate, isoDate), gte(terms.endDate, isoDate)),
    )
    .where(eq(classes.id, classId))
    .orderBy(asc(terms.startDate))
    .limit(1);
  if (!row) return null;

  const weekNumber = weekNumberOn(row.termStart, isoDate);
  const [week] = await db
    .select({
      id: subjectWeeks.id,
      weekNumber: subjectWeeks.weekNumber,
      title: subjectWeeks.title,
    })
    .from(subjectWeeks)
    .where(
      and(
        eq(subjectWeeks.subjectId, row.subjectId),
        eq(subjectWeeks.termId, row.termId),
        eq(subjectWeeks.weekNumber, weekNumber),
      ),
    )
    .limit(1);
  if (!week) return null;

  const plans = await getClassWeekPlans(classId, [week.id]);
  return {
    subjectWeekId: week.id,
    termId: row.termId,
    weekNumber: week.weekNumber,
    title: week.title,
    plan: plans.get(week.id) ?? null,
  };
}
