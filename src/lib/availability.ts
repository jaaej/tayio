import "server-only";
import { and, eq, gte, inArray, isNotNull, lt, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, lessons, profiles, tutorAvailability } from "@/db/schema";

export type AvailableSlot = {
  date: string;
  startTime: string;
  endTime: string;
  tutorId: string;
  tutorName: string;
  isOriginalTutor: boolean;
  /** True when the tutor already has a lesson overlapping this slot, so it
   *  can be shown as taken rather than offered. Set by consumers that compute
   *  bookings (e.g. the admin reschedule picker); undefined = treat as open. */
  taken?: boolean;
};

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Tutors who can teach the subject of `classId`. Marks the class's own tutor
 * as `isOriginal` so the picker can highlight "stay with same tutor" slots.
 */
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

/**
 * All tutors in the system (for the admin "show all tutors" override
 * when rescheduling). `originalTutorId` is marked as `isOriginal`.
 */
export async function getAllTutors(
  originalTutorId?: string,
): Promise<Array<{ id: string; firstName: string; lastName: string; isOriginal: boolean }>> {
  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(and(eq(profiles.role, "tutor"), eq(profiles.isActive, true)));
  return rows.map((r) => ({
    ...r,
    isOriginal: !!originalTutorId && r.id === originalTutorId,
  }));
}

/**
 * Expand tutor availability (recurring weekly + per-date overrides) into
 * concrete date+time slots for the given list of tutors over `weeks` ahead
 * of `fromDate`. Excludes today and past dates.
 */
export async function expandAvailability(
  tutors: Array<{ id: string; firstName: string; lastName: string; isOriginal: boolean }>,
  fromDate: Date,
  weeks: number = 4,
): Promise<AvailableSlot[]> {
  if (tutors.length === 0) return [];

  const tutorIds = tutors.map((t) => t.id);
  const tutorById = new Map(tutors.map((t) => [t.id, t]));

  const totalDays = weeks * 7;
  const todayIso = isoLocal(new Date());
  const horizon = new Date(fromDate);
  horizon.setDate(horizon.getDate() + totalDays);
  const horizonIso = isoLocal(horizon);

  // selectDistinct, not select: availability rows are scoped per subject since
  // migration 0040, so one tutor free Tuesday 16:00-18:00 for both Maths and
  // English has two rows for that window. Rescheduling does not care which
  // subject the slot was tagged for - it only asks whether the tutor is free -
  // so without this the picker offers the identical slot once per subject.
  const weeklyRows = await db
    .selectDistinct({
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

  // Day-isolation sentinel (00:00:00–23:59:59, isAvailable=false): when
  // present, the (tutor, date) pair is detached from recurring weekly
  // rules. The day's actual availability then comes solely from positive
  // per-date override rows below. See `toggleDayIsolation` in
  // src/app/tutor/_actions.ts.
  const unavailableOverrides = new Set<string>();
  const isolatedDays = new Set<string>();
  for (const o of overrideRows) {
    if (!o.date) continue;
    if (!o.isAvailable) {
      if (o.startTime === "00:00:00" && o.endTime === "23:59:59") {
        isolatedDays.add(`${o.tutorId}|${o.date}`);
      } else {
        unavailableOverrides.add(
          `${o.tutorId}|${o.date}|${o.startTime}|${o.endTime}`,
        );
      }
    }
  }

  const out: AvailableSlot[] = [];

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(fromDate);
    d.setDate(fromDate.getDate() + i);
    const iso = isoLocal(d);
    if (iso <= todayIso) continue;
    const dow = d.getDay();
    for (const r of weeklyRows) {
      if (r.weekday !== dow) continue;
      if (isolatedDays.has(`${r.tutorId}|${iso}`)) continue;
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

  for (const o of overrideRows) {
    if (!o.date) continue;
    if (!o.isAvailable) continue;
    if (o.date <= todayIso) continue;
    const t = tutorById.get(o.tutorId);
    if (!t) continue;
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

/**
 * Convenience: same-subject tutors only. Used by parent reschedule flow
 * and by admin reschedule's default (non-override) mode.
 */
export async function getAvailableSlots(
  classId: string,
  fromDate: Date,
  weeks: number = 4,
): Promise<AvailableSlot[]> {
  const tutors = await getEligibleTutors(classId);
  return expandAvailability(tutors, fromDate, weeks);
}

/**
 * Mark each slot `taken` when its tutor already has a lesson overlapping it, so
 * pickers can show it as filled rather than offering it (and hitting the
 * double-booking guard on submit). Shared by the student, parent, and admin
 * reschedule/redemption pickers.
 */
export async function markTakenSlots(
  slots: AvailableSlot[],
): Promise<AvailableSlot[]> {
  if (slots.length === 0) return slots;
  const tutorIds = Array.from(new Set(slots.map((s) => s.tutorId)));
  const dates = slots.map((s) => s.date);
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));
  const booked = await db
    .select({
      tutorId: lessons.tutorId,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
    })
    .from(lessons)
    .where(
      and(
        inArray(lessons.tutorId, tutorIds),
        gte(lessons.date, minDate),
        lte(lessons.date, maxDate),
      ),
    );
  const byKey = new Map<string, { startTime: string; endTime: string }[]>();
  for (const b of booked) {
    const key = `${b.tutorId}|${b.date}`;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(b);
  }
  return slots.map((s) => ({
    ...s,
    taken: (byKey.get(`${s.tutorId}|${s.date}`) ?? []).some(
      (l) => l.startTime < s.endTime && l.endTime > s.startTime,
    ),
  }));
}
