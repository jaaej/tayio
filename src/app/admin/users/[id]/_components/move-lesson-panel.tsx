"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/admin/ui";
import { SidePanel } from "@/components/ui/side-panel";
import { formatDateLong, formatTimeRange } from "@/lib/format";
import { isOnLeave, type LeavePeriod } from "@/lib/student-leave";
import type { AvailableSlot } from "@/lib/availability";
import {
  loadAdminRescheduleOptions,
  rescheduleStudentLesson,
} from "@/app/admin/_lib/actions-reschedule";

export type MovableLesson = {
  id: string;
  subjectName: string;
  date: string;
  startTime: string;
  endTime: string;
  tutorName: string | null;
};

function slotKey(slot: AvailableSlot) {
  return `${slot.date}|${slot.startTime}|${slot.endTime}|${slot.tutorId}`;
}

/**
 * The admin's one-off move of a student's lesson: a side panel listing open
 * slots (this subject's tutors, or every tutor), no notice or allowance
 * limits. Opened from the selected lesson on the student's timetable.
 */
export function MoveLessonPanel({
  studentId,
  lesson,
  leavePeriods,
  onClose,
  onMoved,
}: {
  studentId: string;
  lesson: MovableLesson | null;
  leavePeriods: LeavePeriod[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [slotMode, setSlotMode] = useState<"same-subject" | "all-tutors">("same-subject");
  const [options, setOptions] = useState<{
    sameSubject: AvailableSlot[];
    allTutors: AvailableSlot[];
  } | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lessonId = lesson?.id ?? null;

  useEffect(() => {
    if (!lessonId) {
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
    void loadAdminRescheduleOptions(studentId, lessonId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setOptionsError(result.error);
          return;
        }
        setOptions({ sameSubject: result.sameSubject, allTutors: result.allTutors });
      })
      .catch(() => {
        if (!cancelled) setOptionsError("Couldn't load available slots. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, studentId]);

  const visibleSlots =
    slotMode === "same-subject" ? options?.sameSubject ?? [] : options?.allTutors ?? [];
  const pickedSlot = visibleSlots.find((slot) => slotKey(slot) === selectedSlot) ?? null;

  function close() {
    if (!isPending) onClose();
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
        onMoved();
      } catch {
        setActionError("Couldn't move that lesson. Try again.");
      }
    });
  }

  return (
    <SidePanel
      open={lesson !== null}
      onClose={close}
      title="Move lesson"
      footer={
        <>
          <Button type="button" variant="outline" onClick={close} disabled={isPending}>
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
      {lesson && (
        <form id="move-lesson-form" onSubmit={submit} className="space-y-5">
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="lessonId" value={lesson.id} />
          <input type="hidden" name="slot" value={selectedSlot ?? ""} />

          <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-3">
            <div className="text-[14px] font-bold text-ink">{lesson.subjectName}</div>
            <div className="mt-1 text-[13px] text-ink-soft">
              {[
                formatDateLong(lesson.date),
                formatTimeRange(lesson.startTime, lesson.endTime),
                lesson.tutorName,
              ]
                .filter(Boolean)
                .join(" · ")}
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
                        {formatDateLong(slot.date)} · {formatTimeRange(slot.startTime, slot.endTime)}
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
  );
}
