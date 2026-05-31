import "server-only";
import { and, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, profiles, tutorAvailability } from "@/db/schema";

export type AvailableSlot = {
  date: string;
  startTime: string;
  endTime: string;
  tutorId: string;
  tutorName: string;
  isOriginalTutor: boolean;
};

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getEligibleTutors(
  classId: string,
): Promise<Array<{ id: string; firstName: string; lastName: string; isOriginal: boolean }>> {
  const [target] = await db
    .select({ subjectId: classes.subjectId, tutorId: classes.tutorId })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);
  if (!target) return [];

  const sameSubject = await db
    .select({ tutorId: classes.tutorId })
    .from(classes)
    .where(eq(classes.subjectId, target.subjectId));

  const tutorIds = Array.from(new Set(sameSubject.map((r) => r.tutorId)));
  if (!tutorIds.includes(target.tutorId)) tutorIds.push(target.tutorId);
  if (tutorIds.length === 0) return [];

  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(and(inArray(profiles.id, tutorIds), eq(profiles.role, "tutor")));

  return rows.map((r) => ({
    ...r,
    isOriginal: r.id === target.tutorId,
  }));
}

export async function getAvailableSlots(
  classId: string,
  fromDate: Date,
  weeks: number = 4,
): Promise<AvailableSlot[]> {
  const tutors = await getEligibleTutors(classId);
  if (tutors.length === 0) return [];

  const tutorIds = tutors.map((t) => t.id);
  const tutorById = new Map(tutors.map((t) => [t.id, t]));

  const totalDays = weeks * 7;
  const todayIso = isoLocal(new Date());
  const horizon = new Date(fromDate);
  horizon.setDate(horizon.getDate() + totalDays);
  const horizonIso = isoLocal(horizon);

  // Recurring weekly rules
  const weeklyRows = await db
    .select({
      tutorId: tutorAvailability.tutorId,
      weekday: tutorAvailability.weekday,
      startTime: tutorAvailability.startTime,
      endTime: tutorAvailability.endTime,
    })
    .from(tutorAvailability)
    .where(
      and(
        inArray(tutorAvailability.tutorId, tutorIds),
        isNotNull(tutorAvailability.weekday),
        eq(tutorAvailability.isAvailable, true),
      ),
    );

  // Date-specific overrides (both adds and removes)
  const overrideRows = await db
    .select({
      tutorId: tutorAvailability.tutorId,
      date: tutorAvailability.date,
      startTime: tutorAvailability.startTime,
      endTime: tutorAvailability.endTime,
      isAvailable: tutorAvailability.isAvailable,
    })
    .from(tutorAvailability)
    .where(
      and(
        inArray(tutorAvailability.tutorId, tutorIds),
        isNotNull(tutorAvailability.date),
        gte(tutorAvailability.date, todayIso),
        lt(tutorAvailability.date, horizonIso),
      ),
    );

  // Build a unavailable-override set keyed by tutor|date|start|end
  const unavailableOverrides = new Set<string>();
  for (const o of overrideRows) {
    if (!o.date) continue;
    if (!o.isAvailable) {
      unavailableOverrides.add(
        `${o.tutorId}|${o.date}|${o.startTime}|${o.endTime}`,
      );
    }
  }

  const out: AvailableSlot[] = [];

  // Expand recurring rules into dates
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(fromDate);
    d.setDate(fromDate.getDate() + i);
    const iso = isoLocal(d);
    if (iso <= todayIso) continue;
    const dow = d.getDay();
    for (const r of weeklyRows) {
      if (r.weekday !== dow) continue;
      const key = `${r.tutorId}|${iso}|${r.startTime}|${r.endTime}`;
      if (unavailableOverrides.has(key)) continue;
      const t = tutorById.get(r.tutorId);
      if (!t) continue;
      out.push({
        date: iso,
        startTime: r.startTime,
        endTime: r.endTime,
        tutorId: r.tutorId,
        tutorName: `${t.firstName} ${t.lastName}`.trim(),
        isOriginalTutor: t.isOriginal,
      });
    }
  }

  // Date-specific availability overrides (extra slots not covered by recurring)
  for (const o of overrideRows) {
    if (!o.date) continue;
    if (!o.isAvailable) continue;
    if (o.date <= todayIso) continue;
    const t = tutorById.get(o.tutorId);
    if (!t) continue;
    // Avoid double-adding if a recurring rule already produced this slot
    const dup = out.find(
      (s) =>
        s.tutorId === o.tutorId &&
        s.date === o.date &&
        s.startTime === o.startTime &&
        s.endTime === o.endTime,
    );
    if (dup) continue;
    out.push({
      date: o.date,
      startTime: o.startTime,
      endTime: o.endTime,
      tutorId: o.tutorId,
      tutorName: `${t.firstName} ${t.lastName}`.trim(),
      isOriginalTutor: t.isOriginal,
    });
  }

  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      (a.isOriginalTutor === b.isOriginalTutor ? 0 : a.isOriginalTutor ? -1 : 1) ||
      a.tutorName.localeCompare(b.tutorName),
  );

  return out;
}
