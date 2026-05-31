import "server-only";
import { and, eq, gte, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db/client";
import { tutorAvailability } from "@/db/schema";

export type WeeklyRule = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

export type DateOverride = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

export async function getWeeklyRules(tutorId: string): Promise<WeeklyRule[]> {
  const rows = await db
    .select({
      id: tutorAvailability.id,
      weekday: tutorAvailability.weekday,
      startTime: tutorAvailability.startTime,
      endTime: tutorAvailability.endTime,
    })
    .from(tutorAvailability)
    .where(
      and(
        eq(tutorAvailability.tutorId, tutorId),
        isNotNull(tutorAvailability.weekday),
        eq(tutorAvailability.isAvailable, true),
      ),
    );
  return rows
    .filter((r): r is typeof r & { weekday: number } => r.weekday !== null)
    .map((r) => ({
      id: r.id,
      weekday: r.weekday,
      startTime: r.startTime,
      endTime: r.endTime,
    }));
}

export async function getDateOverrides(
  tutorId: string,
  fromIso: string,
  toIso: string,
): Promise<DateOverride[]> {
  const rows = await db
    .select({
      id: tutorAvailability.id,
      date: tutorAvailability.date,
      startTime: tutorAvailability.startTime,
      endTime: tutorAvailability.endTime,
      isAvailable: tutorAvailability.isAvailable,
    })
    .from(tutorAvailability)
    .where(
      and(
        eq(tutorAvailability.tutorId, tutorId),
        isNotNull(tutorAvailability.date),
        gte(tutorAvailability.date, fromIso),
        lt(tutorAvailability.date, toIso),
      ),
    );
  return rows
    .filter((r): r is typeof r & { date: string } => r.date !== null)
    .map((r) => ({
      id: r.id,
      date: r.date,
      startTime: r.startTime,
      endTime: r.endTime,
      isAvailable: r.isAvailable,
    }));
}
