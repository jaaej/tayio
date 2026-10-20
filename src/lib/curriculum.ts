import "server-only";
import { and, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  terms,
  type Term,
} from "@/db/schema";
import { inclusiveDayCount } from "@/lib/tutor-cover-rules";
import { weekOfTermLabel } from "@/lib/term-week";

export async function resolveCurrentTerm(
  date: Date = new Date(),
): Promise<Term | null> {
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [row] = await db
    .select()
    .from(terms)
    .where(and(lte(terms.startDate, isoDate), gte(terms.endDate, isoDate)))
    .orderBy(terms.startDate)
    .limit(1);
  return row ?? null;
}

export async function resolveMostRecentPastTerm(
  date: Date = new Date(),
): Promise<Term | null> {
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [row] = await db
    .select()
    .from(terms)
    .where(lte(terms.endDate, isoDate))
    .orderBy(desc(terms.endDate))
    .limit(1);
  return row ?? null;
}

export function currentWeekNumber(
  term: Pick<Term, "startDate" | "endDate">,
  maxWeek: number,
  today: Date = new Date(),
): number {
  const start = new Date(`${term.startDate}T00:00:00`);
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  if (week < 1) return 1;
  if (week > maxWeek) return maxWeek;
  return week;
}


/**
 * "Term 4, Week 2" for a Melbourne date, or null outside every term. The
 * portal home headers (admin dashboard, tutor Today) print it after the date.
 */
export async function termWeekLabel(todayIso: string): Promise<string | null> {
  const day = new Date(`${todayIso}T12:00:00`);
  const term = await resolveCurrentTerm(day);
  if (!term) return null;
  const weeks = Math.ceil(inclusiveDayCount(term.startDate, term.endDate) / 7);
  return `Term ${term.termNumber}, Week ${currentWeekNumber(term, weeks, day)}`;
}

/** "Term 4, Week 2" or "Holidays" for the Monday-to-Sunday week starting `weekStart` (`weekOfTermLabel`). */
export async function getWeekOfTermLabel(weekStart: string): Promise<string | null> {
  const rows = await db
    .select({ termNumber: terms.termNumber, startDate: terms.startDate, endDate: terms.endDate })
    .from(terms);
  return weekOfTermLabel(rows, weekStart);
}
