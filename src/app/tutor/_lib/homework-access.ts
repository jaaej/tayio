import "server-only";
import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, homework } from "@/db/schema";

/**
 * The homework a tutor looks after: everything set for a class they teach
 * now (`classes.tutor_id`), so a class handed to another tutor takes its
 * homework and marking with it. Homework set outside a class stays with the
 * tutor it was set for. `homework.tutor_id` is only a copy taken when the
 * homework was set, and `created_by_id` stays the author.
 */
export function tutorHomeworkFilter(tutorId: string): SQL {
  return or(
    inArray(
      homework.classId,
      db.select({ id: classes.id }).from(classes).where(eq(classes.tutorId, tutorId)),
    ),
    and(isNull(homework.classId), eq(homework.tutorId, tutorId)),
  )!;
}
