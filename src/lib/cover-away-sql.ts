import "server-only";
import { sql } from "drizzle-orm";

/**
 * The outer query's `lessons` row is one its tutor asked cover for and
 * nobody on the portal has taken: the request is open, the class passed
 * without cover, or someone off the portal taught it. The tutor didn't teach
 * it, so it is not on their weekly check-in or their lessons to finish. A
 * portal tutor's claim moves the lesson to them instead (`lessons.tutor_id`).
 */
export const tutorAwayFromLessonSql = sql`exists (
  select 1 from tutor_cover_requests cover_away
  where cover_away.lesson_id = lessons.id
    and cover_away.original_tutor_id = lessons.tutor_id
    and cover_away.status in ('open', 'expired', 'external')
)`;
