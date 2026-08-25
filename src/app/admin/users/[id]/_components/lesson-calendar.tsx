"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MonthGrid, type MonthChip } from "@/components/calendar/month-grid";
import { Button } from "@/components/admin/ui";
import { SidePanel } from "@/components/ui/side-panel";
import { formatDateLong, formatTime } from "@/lib/format";
import { isOnLeave, type LeavePeriod } from "@/lib/student-leave";
import type { AvailableSlot } from "@/lib/availability";
import type { StudentLesson } from "@/app/admin/_lib/queries";
import {
  loadAdminRescheduleOptions,
  rescheduleStudentLesson,
} from "@/app/admin/_lib/actions-reschedule";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slotKey(slot: AvailableSlot) {
  return `${slot.date}|${slot.startTime}|${slot.endTime}|${slot.tutorId}`;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Student lesson calendar for the admin record. A future lesson opens the
 * focused move flow in a side panel; historical lessons remain visible but
 * cannot be changed.
 */
export function AdminLessonCalendar({
  studentId,
  year,
  month,
  lessons,
  leavePeriods,
  basePath,
}: {
  studentId: string;
  year: number;
  month: number;
  lessons: StudentLesson[];
  leavePeriods: LeavePeriod[];
  basePath: string;
}) {
  const router = useRouter();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [slotMode, setSlotMode] = useState<"same-subject" | "all-tutors">(
    "same-subject",
  );
  const [options, setOptions] = useState<{
    sameSubject: AvailableSlot[];
    allTutors: AvailableSlot[];
  } | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const today = isoLocal(new Date());
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const shadedDates = useMemo(() => {
    const shaded = new Set<string>();
    const first = new Date(year, month, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - mondayOffset);
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = isoLocal(date);
      if (isOnLeave(iso, leavePeriods)) shaded.add(iso);
    }
    return shaded;
  }, [leavePeriods, month, year]);

  const chips: MonthChip[] = lessons.map((lesson) => {
    const past = lesson.date < today;
    const moved = lesson.status === "rescheduled" || lesson.status === "makeup";
    const unavailable = lesson.status === "cancelled" || lesson.status === "missed";
    return {
      id: lesson.id,
      date: lesson.date,
      label: formatTime(lesson.startTime),
      sublabel: lesson.subjectName,
      sortKey: lesson.startTime,
      tone: past
        ? "bg-surface-2 text-muted"
        : unavailable
          ? "bg-bad-bg text-bad"
          : moved
            ? "bg-warn-bg text-warn"
            : "bg-brand-50 text-brand-700",
      interactive: !past,
      title: past ? "Past lessons cannot be moved" : "Move lesson",
      ariaLabel: `${lesson.subjectName} on ${formatDateLong(lesson.date)} at ${formatTime(lesson.startTime)}${past ? ", past lesson" : ", move lesson"}`,
    };
  });

  useEffect(() => {
    if (!selectedLessonId) {
      setOptions(null);
      setOptionsError(null);
      setSelectedSlot(null);
      setActionError(null);
      return;
    }

    let cancelled = false;
    setOptions(null);
    setOptionsError(null);
    setSelectedSlot(null);
    setActionError(null);
    setSlotMode("same-subject");
    void loadAdminRescheduleOptions(studentId, selectedLessonId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setOptionsError(result.error);
          return;
        }
        setOptions({
          sameSubject: result.sameSubject,
          allTutors: result.allTutors,
        });
      })
      .catch(() => {
        if (!cancelled) setOptionsError("Couldn't load available slots. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLessonId, studentId]);

  const visibleSlots =
    slotMode === "same-subject" ? options?.sameSubject ?? [] : options?.allTutors ?? [];
  const pickedSlot = visibleSlots.find((slot) => slotKey(slot) === selectedSlot) ?? null;

  function navigate(delta: number) {
    const next = new Date(year, month + delta, 1);
    router.push(
      `${basePath}?tab=lessons&month=${monthKey(next.getFullYear(), next.getMonth())}`,
    );
  }

  function closePanel() {
    if (!isPending) setSelectedLessonId(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) return;
    const formData = new FormData(event.currentTarget);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await rescheduleStudentLesson(formData);
        if (!result.ok) {
          setActionError(result.error);
          return;
        }
        setSelectedLessonId(null);
        router.refresh();
      } catch {
        setActionError("Couldn't move that lesson. Try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em] tabular-nums text-ink">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              router.push(
                `${basePath}?tab=lessons&month=${monthKey(now.getFullYear(), now.getMonth())}`,
              );
            }}
            className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600 hover:text-brand-700"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Previous month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft transition-colors hover:border-brand-300 hover:text-ink"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            aria-label="Next month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft transition-colors hover:border-brand-300 hover:text-ink"
          >
            ›
          </button>
        </div>
      </div>

      <MonthGrid
        year={year}
        month={month}
        chips={chips}
        shadedDates={shadedDates}
        onChipClick={setSelectedLessonId}
      />

      <SidePanel
        open={selectedLesson !== null}
        onClose={closePanel}
        title="Move lesson"
        footer={
          <>
            <Button type="button" variant="outline" onClick={closePanel} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="move-lesson-form"
              variant="brand"
              disabled={!selectedSlot || isPending}
            >
              {isPending ? "Moving…" : "Move lesson"}
            </Button>
          </>
        }
      >
        {selectedLesson && (
          <form id="move-lesson-form" onSubmit={submit} className="space-y-5">
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="lessonId" value={selectedLesson.id} />
            <input type="hidden" name="slot" value={selectedSlot ?? ""} />

            <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-3">
              <div className="text-[14px] font-bold text-ink">{selectedLesson.subjectName}</div>
              <div className="mt-1 text-[13px] text-ink-soft">
                {formatDateLong(selectedLesson.date)} · {formatTime(selectedLesson.startTime)}–{formatTime(selectedLesson.endTime)} · {selectedLesson.tutorFirstName} {selectedLesson.tutorLastName}
              </div>
            </div>

            <div className="grid grid-cols-2 rounded-[12px] border border-line bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => {
                  setSlotMode("same-subject");
                  setSelectedSlot(null);
                }}
                className={slotMode === "same-subject" ? "rounded-[9px] bg-surface px-3 py-2 text-[12px] font-bold text-ink shadow-sm" : "rounded-[9px] px-3 py-2 text-[12px] font-bold text-muted hover:text-ink"}
              >
                Same subject
              </button>
              <button
                type="button"
                onClick={() => {
                  setSlotMode("all-tutors");
                  setSelectedSlot(null);
                }}
                className={slotMode === "all-tutors" ? "rounded-[9px] bg-surface px-3 py-2 text-[12px] font-bold text-ink shadow-sm" : "rounded-[9px] px-3 py-2 text-[12px] font-bold text-muted hover:text-ink"}
              >
                All tutors
              </button>
            </div>

            {optionsError && <p role="alert" className="text-[13px] font-medium text-bad">{optionsError}</p>}
            {!options && !optionsError && <p className="text-[13px] text-muted">Loading available slots…</p>}
            {options && visibleSlots.length === 0 && <p className="text-[13px] text-muted">No available slots in the next four weeks.</p>}
            {options && visibleSlots.length > 0 && (
              <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
                {visibleSlots.map((slot) => {
                  const key = slotKey(slot);
                  const active = selectedSlot === key;
                  return (
                    <label
                      key={key}
                      className={slot.taken ? "flex cursor-not-allowed items-center gap-3 bg-surface-2 px-3.5 py-3 text-muted opacity-70" : "flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors hover:bg-surface-2"}
                    >
                      <input
                        type="radio"
                        name="chosen-slot"
                        value={key}
                        checked={active}
                        disabled={slot.taken}
                        onChange={() => setSelectedSlot(key)}
                        className="h-4 w-4 border-line-strong text-brand-500 focus:ring-brand-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold text-ink">
                          {formatDateLong(slot.date)} · {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-ink-soft">
                          {slot.tutorName}{slot.isOriginalTutor ? " · current tutor" : ""}
                        </span>
                      </span>
                      {slot.taken && <span className="text-[11px] font-bold uppercase tracking-[0.12em]">Taken</span>}
                    </label>
                  );
                })}
              </div>
            )}

            {pickedSlot && isOnLeave(pickedSlot.date, leavePeriods) && (
              <p className="rounded-[12px] border border-warn/35 bg-warn-bg px-3.5 py-3 text-[13px] text-warn">
                This student is marked away on {formatDateLong(pickedSlot.date)}. You can still move the lesson if this is intentional.
              </p>
            )}
            {actionError && <p role="alert" className="text-[13px] font-medium text-bad">{actionError}</p>}

            <div>
              <label htmlFor="move-reason" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Reason (optional)
              </label>
              <textarea
                id="move-reason"
                name="reason"
                rows={3}
                maxLength={2000}
                placeholder="e.g. parent called, family event"
                className="w-full rounded-[14px] border border-line-strong bg-surface px-4 py-2.5 text-[14px] text-ink focus:border-brand-500 focus:outline-none"
              />
            </div>
          </form>
        )}
      </SidePanel>
    </div>
  );
}
