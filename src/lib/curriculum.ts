import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  terms,
  type Term,
} from "@/db/schema";

export async function resolveCurrentTerm(
  date: Date = new Date(),
): Promise<Term | null> {
  const isoDate = date.toISOString().slice(0, 10);
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
  const isoDate = date.toISOString().slice(0, 10);
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

