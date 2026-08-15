"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { submitReschedule, grantRescheduleCredit } from "@/app/_actions/reschedule";
import { cancelLesson } from "@/app/_actions/credits";
import { CANCEL_CAP, RESCHEDULE_CAP } from "@/lib/reschedule-credits";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2";

export type SlotOption = {
  tutorId: string;
  date: string;
  startTime: string;
  endTime: string;
  tutorName: string;
};

export type TargetOption = {
  lessonId: string;
  className: string;
  tutorName: string;
  date: string;
  startTime: string;
  endTime: string;
  seatsLeft: number;
};

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

function fmtDateLong(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "pm" : "am";
  const hr = hour % 12 === 0 ? 12 : hour % 12;
  return `${hr}:${m}${suffix}`;
}

/**
 * Shared reschedule picker used by the student and parent portals.
 * mode "makeup" (1-on-1) picks a same-tutor availability slot; mode "switch"
 * (group) picks another same-subject session. Approval is retired - every
 * reschedule moves the lesson directly once the 7-day notice + per-term cap
 * pass; the server re-derives and enforces both regardless of `canReschedule`.
 *
 * Options are laid out on a Mon-first month calendar (like the admin reschedule
 * screen): each date cell lists its clickable slots/sessions.
 */
export function RescheduleForm(props: {
  lessonId: string;
  studentId?: string;
  mode: "makeup" | "switch";
  /** Server-computed: term resolved + 7-day notice met + reschedule cap not
   *  reached. When false, the picker is replaced with a "message the office"
   *  state - the server re-checks all of this regardless. */
  canReschedule: boolean;
  /** Shown when `canReschedule` is false, explaining why. */
  rescheduleIneligibleReason?: string;
  /** Remaining reschedules this term, shown as an allowance label. Omit or
   *  pass null when not in a resolved term. */
  rescheduleRemaining?: number | null;
  slots?: SlotOption[];
  targets?: TargetOption[];
  backHref: string;
  /** Admin office profile id to message when no slot is available. Null if
   *  no admin contact is available (empty state falls back to plain text). */
  adminId?: string | null;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const slots = props.slots ?? [];
  const targets = props.targets ?? [];
  const empty = props.mode === "makeup" ? slots.length === 0 : targets.length === 0;

  // Normalise both modes into a common cell item shape.
  type Item = {
    code: string;
    date: string;
    startTime: string;
    endTime: string;
    /** primary label under the time, e.g. tutor name or class name */
    label: string;
    /** optional right-aligned meta, e.g. "3 seats" */
    meta?: string;
  };
  const items = useMemo<Item[]>(() => {
    if (props.mode === "makeup") {
      return slots.map((s) => ({
        code: `${s.tutorId}|${s.date}|${s.startTime}|${s.endTime}`,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        label: s.tutorName,
      }));
    }
    return targets.map((t) => ({
      code: t.lessonId,
      date: t.date,
      startTime: t.startTime,
      endTime: t.endTime,
      label: t.className,
      meta: `${t.seatsLeft} seat${t.seatsLeft === 1 ? "" : "s"}`,
    }));
  }, [props.mode, slots, targets]);

  const itemsByDate = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items) {
      const list = m.get(it.date) ?? [];
      list.push(it);
      m.set(it.date, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [items]);

  const pickedItem = useMemo(
    () => items.find((it) => it.code === picked) ?? null,
    [items, picked],
  );

  // Default the visible month to the month of the earliest available option.
  const earliestDate = useMemo(() => {
    if (items.length === 0) return new Date();
    const min = items.reduce((a, b) => (a.date <= b.date ? a : b)).date;
    return new Date(`${min}T00:00:00`);
  }, [items]);
  const [view, setView] = useState({
    year: earliestDate.getFullYear(),
    month: earliestDate.getMonth(),
  });

  // Build a 6-row month grid (Mon-first).
  const firstOfMonth = new Date(view.year, view.month, 1);
  const firstDow = firstOfMonth.getDay();
  const mondayOffset = (firstDow + 6) % 7;
  const gridStart = new Date(view.year, view.month, 1 - mondayOffset);
  const todayIso = isoLocal(new Date());

  const days: {
    iso: string;
    dayNum: number;
    inMonth: boolean;
    isPast: boolean;
    items: Item[];
  }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = isoLocal(d);
    days.push({
      iso,
      dayNum: d.getDate(),
      inMonth: d.getMonth() === view.month,
      isPast: iso < todayIso,
      items: itemsByDate.get(iso) ?? [],
    });
  }
  const rowCount = Math.ceil(days.length / 7);
  let usedRows = rowCount;
  if (rowCount === 6) {
    const lastRow = days.slice(35, 42);
    if (lastRow.every((d) => !d.inMonth)) usedRows = 5;
  }
  const visibleDays = days.slice(0, usedRows * 7);

  function navMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    const fd = new FormData();
    fd.set("lessonId", props.lessonId);
    if (props.studentId) fd.set("studentId", props.studentId);
    fd.set("targetKind", props.mode);
    fd.set("reason", reason);
    if (props.mode === "switch") fd.set("targetLessonId", picked);
    else fd.set("slot", picked);
    start(async () => {
      const res = await submitReschedule(fd);
      setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
    });
  }

  function useCreditInstead() {
    const fd = new FormData();
    fd.set("lessonId", props.lessonId);
    if (props.studentId) fd.set("studentId", props.studentId);
    start(async () => {
      const res = await grantRescheduleCredit(fd);
      setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
    });
  }

  if (result?.ok) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6 text-center">
        <div className="text-[15px] font-bold text-ink">{result.text}</div>
        <Link
          href={props.backHref}
          className="mt-3 inline-block text-[13px] font-bold text-brand-600 hover:text-brand-700"
        >
          Back to timetable →
        </Link>
      </div>
    );
  }

  if (!props.canReschedule) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6">
        <div className="text-[14px] text-muted">
          {props.rescheduleIneligibleReason ??
            "This lesson can no longer be rescheduled."}{" "}
          Please contact the office.
        </div>
        {props.adminId && (
          <Link
            href={`/parent/messages/with/${props.adminId}`}
            className={
              "mt-4 inline-flex min-h-11 items-center justify-center rounded-[12px] bg-brand-500 px-5 text-[14px] font-bold text-white transition-colors hover:bg-brand-600 " +
              FOCUS_RING
            }
          >
            Message the office
          </Link>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6">
        <div className="text-[14px] text-muted">
          {props.mode === "makeup"
            ? "Your tutor has no open slots in the next few weeks. Please contact the office, or convert this lesson to a class credit instead."
            : "No other sessions are available this week. Please contact the office."}
        </div>
        {result && !result.ok && (
          <div className="mt-3 text-[13px] font-semibold text-bad">{result.text}</div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={useCreditInstead}
            disabled={pending}
            className={
              "inline-flex min-h-11 items-center justify-center rounded-[12px] bg-brand-500 px-5 text-[14px] font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-50 " +
              FOCUS_RING
            }
          >
            {pending ? "Working…" : "Get a class credit instead"}
          </button>
          {props.adminId && (
            <Link
              href={`/parent/messages/with/${props.adminId}`}
              className={
                "inline-flex min-h-11 items-center justify-center rounded-[12px] border border-line bg-surface px-5 text-[14px] font-bold text-ink transition-colors hover:border-brand-300 " +
                FOCUS_RING
              }
            >
              Message the office
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Calendar header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-[18px] font-extrabold tracking-[-0.01em] text-ink tabular-nums">
            {MONTH_NAMES[view.month]} {view.year}
          </h3>
          {typeof props.rescheduleRemaining === "number" && (
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
              {props.rescheduleRemaining} of {RESCHEDULE_CAP} left
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navMonth(-1)}
            aria-label="Previous month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-brand-50 hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() =>
              setView({
                year: earliestDate.getFullYear(),
                month: earliestDate.getMonth(),
              })
            }
            className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted transition-colors hover:bg-brand-50 hover:text-ink"
          >
            Earliest
          </button>
          <button
            type="button"
            onClick={() => navMonth(1)}
            aria-label="Next month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-brand-50 hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1.5 text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {visibleDays.map((d) => (
          <div
            key={d.iso}
            className={
              "flex min-h-[120px] flex-col rounded-[14px] border " +
              (d.inMonth ? "border-line bg-surface" : "border-line/60 bg-surface")
            }
          >
            <div className="px-2 pt-1.5 pb-1">
              <span
                className={
                  "text-[15px] font-extrabold leading-none tabular-nums " +
                  (d.inMonth ? "text-ink" : "text-muted/50")
                }
              >
                {d.dayNum}
              </span>
            </div>

            <div className="flex-1 space-y-1 overflow-hidden px-1.5 pb-1.5">
              {d.isPast || !d.inMonth
                ? null
                : d.items.slice(0, 4).map((it) => {
                    const active = picked === it.code;
                    return (
                      <button
                        key={it.code}
                        type="button"
                        onClick={() => setPicked(it.code)}
                        className={
                          "block w-full overflow-hidden rounded-lg border px-1.5 py-1 text-left leading-tight transition-all " +
                          (active
                            ? "border-brand-500 bg-brand-500 text-white"
                            : "border-line bg-brand-50 text-ink hover:-translate-y-[1px] hover:border-brand-300")
                        }
                      >
                        <div className="text-[11px] font-bold tabular-nums">
                          {fmtTime(it.startTime)}
                        </div>
                        <div
                          className={
                            "mt-0.5 truncate text-[11px] font-semibold " +
                            (active ? "text-white/85" : "text-muted")
                          }
                        >
                          {it.label}
                        </div>
                        {it.meta && (
                          <div
                            className={
                              "text-[10px] font-bold " +
                              (active ? "text-white/75" : "text-muted")
                            }
                          >
                            {it.meta}
                          </div>
                        )}
                      </button>
                    );
                  })}
              {d.inMonth && !d.isPast && d.items.length > 4 && (
                <div className="px-1 text-[10px] italic text-muted">
                  +{d.items.length - 4} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reason */}
      <div>
        <label
          htmlFor="reason"
          className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted"
        >
          Reason (optional)
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brand-500"
          placeholder="e.g. clash with another commitment"
        />
      </div>

      {result && !result.ok && (
        <div className="text-[13px] font-semibold text-bad">{result.text}</div>
      )}

      {/* Selected summary */}
      <div className="flex items-center justify-between gap-3 text-[13px]">
        {pickedItem ? (
          <span className="font-semibold text-ink">
            Selected: {fmtDateLong(pickedItem.date)} · {fmtTime(pickedItem.startTime)}–
            {fmtTime(pickedItem.endTime)} · {pickedItem.label}
            {pickedItem.meta ? ` · ${pickedItem.meta}` : ""}
          </span>
        ) : (
          <span className="text-muted">Select a slot on the calendar above.</span>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={props.backHref}
          className={"min-h-11 inline-flex items-center text-[13px] font-bold text-muted hover:text-ink " + FOCUS_RING}
        >
          Back
        </Link>
        <button
          type="submit"
          disabled={!picked || pending}
          className={
            "min-h-11 rounded-[12px] bg-brand-500 px-5 text-[14px] font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-50 " +
            FOCUS_RING
          }
        >
          {pending ? "Submitting…" : "Confirm reschedule"}
        </button>
      </div>
    </form>
  );
}

/**
 * Standalone cancel-lesson action for the parent (and unrestricted student)
 * reschedule detail page. Kept as its own component/card rather than folded
 * into `RescheduleForm` so each card carries a single primary action -
 * "Confirm reschedule" here, "Cancel lesson" there.
 */
export function CancelLessonAction(props: {
  lessonId: string;
  studentId?: string;
  /** Server-computed: term resolved + 24h notice met + cancellation cap not
   *  reached + lesson not already moved/cancelled. The server re-checks all
   *  of this regardless. */
  canCancel: boolean;
  /** Shown when `canCancel` is false, explaining why. */
  cancelIneligibleReason?: string;
  /** Remaining cancellations this term, shown as an allowance label. Omit or
   *  pass null when not in a resolved term. */
  cancelRemaining?: number | null;
  /** Admin office profile id to message when cancellation isn't available.
   *  Null if no admin contact is available (falls back to plain text). */
  adminId?: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function confirmCancel() {
    const fd = new FormData();
    fd.set("lessonId", props.lessonId);
    if (props.studentId) fd.set("studentId", props.studentId);
    start(async () => {
      const res = await cancelLesson(fd);
      setConfirming(false);
      setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  }

  if (result?.ok) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6 text-center">
        <div className="text-[15px] font-bold text-ink">{result.text}</div>
      </div>
    );
  }

  if (!props.canCancel) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6">
        <div className="text-[14px] text-muted">
          {props.cancelIneligibleReason ?? "This lesson can no longer be cancelled."}{" "}
          Please contact the office.
        </div>
        {props.adminId && (
          <Link
            href={`/parent/messages/with/${props.adminId}`}
            className={
              "mt-4 inline-flex min-h-11 items-center justify-center rounded-[12px] border border-line bg-surface px-5 text-[14px] font-bold text-ink transition-colors hover:border-brand-300 " +
              FOCUS_RING
            }
          >
            Message the office
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface p-6 space-y-3">
      <div className="text-[14px] text-muted">
        Cancelling adds a class credit you can redeem for another time with
        the same tutor.
      </div>

      {result && !result.ok && (
        <div className="text-[13px] font-semibold text-bad">{result.text}</div>
      )}

      {confirming ? (
        <div className="rounded-[12px] border border-bad/40 bg-surface p-4 space-y-3">
          <div className="text-[13px] font-semibold text-ink">
            This uses 1 of your {CANCEL_CAP} term cancellations and adds a
            class credit.
          </div>
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={
                "min-h-11 rounded-[10px] px-4 text-[13px] font-bold text-muted transition-colors hover:bg-surface-2 " +
                FOCUS_RING
              }
            >
              Back
            </button>
            <button
              type="button"
              onClick={confirmCancel}
              disabled={pending}
              className={
                "min-h-11 rounded-[10px] bg-bad px-4 text-[13px] font-bold text-white transition-colors hover:opacity-90 disabled:opacity-50 " +
                FOCUS_RING
              }
            >
              {pending ? "Cancelling…" : "Cancel lesson"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={
            "inline-flex min-h-11 items-center justify-center rounded-[12px] border border-bad/40 bg-surface px-5 text-[14px] font-bold text-bad transition-colors hover:bg-bad-bg " +
            FOCUS_RING
          }
        >
          {typeof props.cancelRemaining === "number"
            ? `Cancel lesson (${props.cancelRemaining} of ${CANCEL_CAP} left)`
            : "Cancel lesson"}
        </button>
      )}
    </div>
  );
}
