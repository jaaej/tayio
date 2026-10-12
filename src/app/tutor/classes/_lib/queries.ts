import "server-only";
import { and, eq, gte, min, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { lessons } from "@/db/schema";

/** Each class's next lesson date (today onward), for sorting the class cards. */
export async function getNextLessonDateByClass(
  tutorId: string,
  todayIso: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({ classId: lessons.classId, next: min(lessons.date) })
    .from(lessons)
    .where(
      and(
        eq(lessons.tutorId, tutorId),
        gte(lessons.date, todayIso),
        notInArray(lessons.status, ["cancelled", "rescheduled"]),
      ),
    )
    .groupBy(lessons.classId);
  return new Map(
    rows.flatMap((r) => (r.next ? [[r.classId, r.next] as const] : [])),
  );
}
