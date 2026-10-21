import "server-only";
import { and, lte, sql } from "drizzle-orm";
import { enrollments } from "@/db/schema";

/**
 * An enrolment that overlapped the term (Melbourne dates): joined by its end,
 * and not gone before it started (`ends_on` is the first day off the rolls;
 * an enrolment withdrawn before migration 0080 counts from its withdrawal).
 * Term reports use it for who had a class in the term.
 */
export function enrolledInTermSql(term: { startDate: string; endDate: string }) {
  return and(
    lte(sql`(${enrollments.enrolledAt} at time zone 'Australia/Melbourne')::date`, term.endDate),
    sql`case when ${enrollments.endsOn} is not null then ${enrollments.endsOn} > ${term.startDate}
      else ${enrollments.withdrawnAt} is null
        or (${enrollments.withdrawnAt} at time zone 'Australia/Melbourne')::date >= ${term.startDate} end`,
  );
}
