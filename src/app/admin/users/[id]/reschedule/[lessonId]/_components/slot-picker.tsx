"use client";

import { useMemo, useState } from "react";
import type { AvailableSlot } from "@/lib/availability";
import { rescheduleStudentLesson } from "@/app/admin/_lib/actions-reschedule";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "pm" : "am";
  const hr = hour % 12 === 0 ? 12 : hour % 12;
  return `${hr}:${m}${suffix}`;
}

function fmtDateLong(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function SlotPicker({
  studentId,
  lessonId,
  originalLessonDate,
  sameSubjectSlots,
  allTutorSlots,
}: {
  studentId: string;
  lessonId: string;
  /** ISO date YYYY-MM-DD of the lesson being rescheduled — highlighted in calendar */
  originalLessonDate: string;
  sameSubjectSlots: AvailableSlot[];
  allTutorSlots: AvailableSlot[];
}) {
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // Default to the month that contains the original lesson, so admin sees
  // alternative slots clustered near the date they're moving from.
  const originalDate = useMemo(
    () => new Date(`${originalLessonDate}T00:00:00`),
    [originalLessonDate],
  );
  const [view, setView] = useState({
    year: originalDate.getFullYear(),
    month: originalDate.getMonth(),
  });

  const slots = showAll ? allTutorSlots : sameSubjectSlots;
  const slotsByDate = useMemo(() => {
    const m = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [slots]);

  // Build a 6-row month grid (Mon-first)
  const firstOfMonth = new Date(view.year, view.month, 1);
  const firstDow = firstOfMonth.getDay();
  const mondayOffset = (firstDow + 6) % 7;
  const gridStart = new Date(view.year, view.month, 1 - mondayOffset);
  const todayIso = isoLocal(new Date());

  const days: {
    iso: string;
    dayNum: number;
    inMonth: boolean;
    isToday: boolean;
    isPast: boolean;
    isWeekend: boolean;
    isOriginal: boolean;
    slots: AvailableSlot[];
  }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = isoLocal(d);
    days.push({
      iso,
      dayNum: d.getDate(),
      inMonth: d.getMonth() === view.month,
      isToday: iso === todayIso,
      isPast: iso < todayIso,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isOriginal: iso === originalLessonDate,
      slots: slotsByDate.get(iso) ?? [],
    });
  }
  const rowCount = Math.ceil(days.length / 7);
  let usedRows = rowCount;
  if (rowCount === 6) {
    const lastRow = days.slice(35, 42);
    if (lastRow.every((d) => !d.inMonth)) usedRows = 5;
  }
  const visibleDays = days.slice(0, usedRows * 7);

  const encode = (s: AvailableSlot) =>
    `${s.date}|${s.startTime}|${s.endTime}|${s.tutorId}`;

  const pickedSlot = useMemo(() => {
    if (!picked) return null;
    return [...sameSubjectSlots, ...allTutorSlots].find(
      (s) => encode(s) === picked,
    );
  }, [picked, sameSubjectSlots, allTutorSlots]);

  function navMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <form action={rescheduleStudentLesson} className="space-y-5">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="slot" value={picked ?? ""} />

      {/* Toggle */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted font-semibold mb-1">
            Available slots
          </div>
          <div className="text-sm text-ink-soft">
            {showAll
              ? `Showing all active tutors · ${slots.length} slot${slots.length === 1 ? "" : "s"} total`
              : `Same-subject tutors only · ${slots.length} slot${slots.length === 1 ? "" : "s"} total`}
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => {
              setShowAll(e.target.checked);
              setPicked(null);
            }}
            className="h-4 w-4 rounded border-hairline/60 text-brand-600 focus:ring-brand-500"
          />
          Show all tutors
        </label>
      </div>

      {/* Calendar header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-medium text-ink tabular-nums">
          {MONTH_NAMES[view.month]} {view.year}
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navMonth(-1)}
            aria-label="Previous month"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-hairline/60 bg-card text-lg text-ink-soft hover:border-brand-400 hover:text-ink transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() =>
              setView({
                year: originalDate.getFullYear(),
                month: originalDate.getMonth(),
              })
            }
            className="px-2.5 h-9 inline-flex items-center justify-center rounded-lg border border-hairline/60 bg-card text-xs uppercase tracking-[0.14em] text-ink-soft hover:border-brand-400 hover:text-ink transition-colors"
          >
            Original
          </button>
          <button
            type="button"
            onClick={() => navMonth(1)}
            aria-label="Next month"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-hairline/60 bg-card text-lg text-ink-soft hover:border-brand-400 hover:text-ink transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-2">
        {visibleDays.map((d) => (
          <div
            key={d.iso}
            className={
              "min-h-[140px] lg:min-h-[156px] rounded-xl border flex flex-col transition-colors " +
              (d.isOriginal
                ? "border-rose-300 bg-rose-50/40"
                : d.isToday
                  ? "border-navy-800/30 bg-gradient-to-b from-brand-50 to-white"
                  : !d.inMonth
                    ? "border-hairline/30 bg-card/40"
                    : d.isWeekend
                      ? "border-hairline/40 bg-brand-50/30"
                      : "border-hairline/40 bg-card")
            }
          >
            <div className="px-2.5 pt-1.5 pb-1 flex items-center justify-between">
              <span
                className={
                  "text-lg font-medium tabular-nums leading-none " +
                  (d.isOriginal
                    ? "text-rose-700"
                    : d.isToday
                      ? "text-navy-800"
                      : d.inMonth
                        ? "text-ink"
                        : "text-muted/60")
                }
              >
                {d.dayNum}
              </span>
              {d.isOriginal && (
                <span className="text-[9px] uppercase tracking-[0.14em] text-rose-700 font-semibold">
                  Original
                </span>
              )}
              {!d.isOriginal && d.slots.length > 0 && d.inMonth && (
                <span className="text-[10px] tabular-nums text-muted">
                  {d.slots.length}
                </span>
              )}
            </div>

            <div className="px-1.5 pb-1.5 flex-1 space-y-1 overflow-hidden">
              {d.isPast || !d.inMonth ? null : d.slots.length === 0 ? (
                <div className="text-[10px] text-muted/40 px-1 py-2 text-center italic">
                  —
                </div>
              ) : (
                d.slots.slice(0, 4).map((s) => {
                  const code = encode(s);
                  const active = picked === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setPicked(code)}
                      className={
                        "block w-full text-left rounded-md px-1.5 py-1 leading-tight overflow-hidden transition-all border " +
                        (active
                          ? "bg-brand-600 border-brand-600 text-white"
                          : "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-300 hover:-translate-y-[1px]")
                      }
                    >
                      <div className="text-[11px] font-bold tabular-nums">
                        {fmtTime(s.startTime)}
                      </div>
                      <div
                        className={
                          "mt-0.5 text-[11px] truncate font-medium " +
                          (active ? "text-white/85" : "text-emerald-800")
                        }
                      >
                        {s.tutorName.split(" ")[0]}
                        {s.isOriginalTutor && (
                          <span className="ml-1 text-[9px] opacity-70">
                            ·same
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
              {d.slots.length > 4 && d.inMonth && !d.isPast && (
                <div className="text-[10px] text-muted px-1 italic">
                  +{d.slots.length - 4} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 pt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Available slot
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          Original lesson date
        </span>
      </div>

      {/* Selected slot summary */}
      {pickedSlot && (
        <div className="rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-brand-700 font-semibold">
              Selected
            </div>
            <div className="mt-1 text-sm text-ink">
              {fmtDateLong(pickedSlot.date)} · {fmtTime(pickedSlot.startTime)}–
              {fmtTime(pickedSlot.endTime)} · {pickedSlot.tutorName}
              {pickedSlot.isOriginalTutor && (
                <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-brand-700">
                  · original tutor
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="text-xs text-brand-700 hover:text-brand-800 underline-offset-4 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Reason */}
      <div>
        <label
          htmlFor="reason"
          className="block text-[11px] uppercase tracking-[0.16em] text-muted font-semibold mb-1.5"
        >
          Reason (optional)
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. parent called, family event"
          className="w-full rounded-xl border border-hairline/70 bg-card px-4 py-2.5 text-sm text-ink focus:border-brand-600 focus:outline-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={!picked}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Confirm reschedule
        </button>
      </div>
    </form>
  );
}
