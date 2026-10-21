import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { lessonGuestIdsSql } from "@/lib/class-roster-sql";

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The students booked onto a lesson outside its class (`lessonGuestIdsSql`). */
export async function lessonGuestIds(lessonId: string, executor: DbExecutor = db): Promise<string[]> {
  const rows = await executor.execute<{ student_id: string }>(
    sql`select guests.student_id from ${lessonGuestIdsSql(sql`${lessonId}::uuid`)} guests`,
  );
  return rows.map((r) => r.student_id);
}

/**
 * Is anyone other than these students booked onto the lesson or marked on
 * it? When a make-up's booking is undone, its private lesson goes only if
 * nobody else is on it.
 */
export async function othersOnLesson(
  executor: DbExecutor,
  lessonId: string,
  exceptStudentIds: readonly string[],
): Promise<boolean> {
  const except = exceptStudentIds.length
    ? sql`and who.student_id not in (${sql.join(
        exceptStudentIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`
    : sql``;
  const rows = await executor.execute(sql`
    select 1 from (
      ${lessonGuestIdsSql(sql`${lessonId}::uuid`)}
      union
      select a.student_id from attendance a where a.lesson_id = ${lessonId}::uuid
    ) who
    where true ${except}
    limit 1
  `);
  return rows.length > 0;
}
