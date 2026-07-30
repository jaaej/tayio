"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatTime, formatDateLong } from "@/lib/format";
import {
  loadRescheduleOptions,
  submitReschedule,
  grantRescheduleCredit,
  type RescheduleSlot,
} from "@/app/_actions/reschedule";
import {
  cancelLesson,
  loadCreditRedemption,
  redeemCredit,
} from "@/app/_actions/credits";
import type { PanelCredit } from "@/components/reschedule/credit-panel";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type TimetableChip = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  subjectId: string;
  subjectName: string;
  className: string;
  studentState:
    | "normal"
    | "moved_out"
    | "makeup_in"
    | "pending_out"
    | "pending_in";
  moveLabel: string | null;
  /** Base eligibility - lesson is upcoming, in the future, and in a state
   *  self-serve actions make sense for. Every lesson opens the action menu;
   *  this only gates whether the reschedule/cancel actions are live vs shown
   *  greyed-out with a reason. */
  canManage: boolean;
  /** canManage AND in a resolved term AND 7-day notice met AND reschedule cap
   *  not reached this term. */
  canReschedule: boolean;
  /** canManage AND in a resolved term AND 24h notice met AND cancellation cap
   *  not reached this term. */
  canCancel: boolean;
  /** Remaining reschedules this term, or null if the lesson isn't in a
   *  resolved term. */
  rescheduleRemaining: number | null;
  /** Remaining cancellations this term, or null if the lesson isn't in a
   *  resolved term. */
  cancelRemaining: number | null;
  /** Effective per-term caps (base 3 + admin allowance bonus) - the denominator
   *  shown in the "N of X left" labels. */
  rescheduleCap: number;
  cancelCap: number;
  /** When reschedule is unavailable, a short reason ("Passed", "Needs 7 days
   *  notice", ...) shown on the greyed-out action. null when reschedulable. */
  rescheduleReason: string | null;
  /** When cancel is unavailable, a short reason shown on the greyed-out
   *  action. null when cancellable. */
  cancelReason: string | null;
  /** This lesson has been cancelled by the student (a credit was granted).
   *  Rendered struck-through in red with a single "Cancelled" status. */
  cancelled: boolean;
};
export type TimetableHw = {
  id: string;
  dueDate: string;
  title: string;
  done: boolean;
};

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1";

/** The two things that share the calendar slot-picking overlay: rescheduling a
 *  lesson, and redeeming a class credit. */
type PickAction =
  | { type: "reschedule"; lessonId: string; hasSlots: boolean }
  | { type: "credit"; creditId: string };
type Mode =
  | { kind: "idle" }
  | { kind: "menu"; lessonId: string }
  | { kind: "cancel-confirm"; lessonId: string }
  | {
      kind: "picking";
      action: PickAction;
      subjectName: string;
      slots: RescheduleSlot[];
      picked: RescheduleSlot | null;
    };

export function InteractiveTimetable({
  initialYear,
  initialMonth,
  lessons,
  homework,
  credits,
  adminId,
  studentId,
  subjectBase = "/student/subjects",
  subjectQuery = "",
  messageBase = "/student/messages/with",
  homeworkHref = (h) => `/student/homework/${h.id}`,
}: {
  initialYear: number;
  initialMonth: number;
  lessons: TimetableChip[];
  homework: TimetableHw[];
  /** The student's active class credits, redeemed via the same calendar
   *  slot-picking overlay as a reschedule. */
  credits: PanelCredit[];
  /** Admin office profile id to message when no reschedule slot is
   *  available. Null if no admin contact is available (empty state
   *  falls back to plain text with no link). */
  adminId: string | null;
  /** Acting on behalf of this student (parent portal). Undefined on the
   *  student's own timetable, where every action defaults to the caller. */
  studentId?: string;
  /** Base path for the "Go to subject" link - `${subjectBase}/${lesson.subjectId}${subjectQuery}`. */
  subjectBase?: string;
  /** Query string appended after the subject id, e.g. `?child=${studentId}` so
   *  the parent portal's subject page (which otherwise defaults to the
   *  parent's first child) resolves the same child this timetable is for. */
  subjectQuery?: string;
  /** Base path for "Message the office" links - `${messageBase}/${adminId}`. */
  messageBase?: string;
  /** Href for a homework due-date chip. Defaults to the student's own
   *  homework detail page - there is no per-item detail page for the parent
   *  portal, so the parent passes a href to the (child-filtered) homework
   *  list instead. */
  homeworkHref?: (h: TimetableHw) => string;
}) {
  const router = useRouter();
  const [view, setView] = useState({ year: initialYear, month: initialMonth });
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [loading, startLoad] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const picking = mode.kind === "picking" ? mode : null;
  const cancelConfirming = mode.kind === "cancel-confirm" ? mode : null;

  const lessonsByDate = useMemo(() => {
    const m = new Map<string, TimetableChip[]>();
    for (const l of lessons) (m.get(l.date) ?? m.set(l.date, []).get(l.date)!).push(l);
    for (const list of m.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return m;
  }, [lessons]);
  const hwByDate = useMemo(() => {
    const m = new Map<string, TimetableHw[]>();
    for (const h of homework) (m.get(h.dueDate) ?? m.set(h.dueDate, []).get(h.dueDate)!).push(h);
    return m;
  }, [homework]);
  const slotsByDate = useMemo(() => {
    const m = new Map<string, RescheduleSlot[]>();
    if (picking) {
      for (const s of picking.slots)
        (m.get(s.date) ?? m.set(s.date, []).get(s.date)!).push(s);
      for (const list of m.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [picking]);

  // Build a Mon-first 6-row grid for the viewed month.
  const firstOfMonth = new Date(view.year, view.month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(view.year, view.month, 1 - mondayOffset);
  const todayIso = isoLocal(new Date());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = isoLocal(d);
    return {
      iso,
      dayNum: d.getDate(),
      inMonth: d.getMonth() === view.month,
      isToday: iso === todayIso,
    };
  });
  const usedRows =
    days.slice(35, 42).every((d) => !d.inMonth) ? 5 : 6;
  const visibleDays = days.slice(0, usedRows * 7);

  function navMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function jumpToFirstSlot(slots: RescheduleSlot[]) {
    if (slots.length === 0) return;
    const first = slots.reduce((a, b) => (a.date <= b.date ? a : b));
    const d = new Date(`${first.date}T00:00:00`);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  }

  function openReschedule(lessonId: string) {
    startLoad(async () => {
      const opts = await loadRescheduleOptions(lessonId, studentId);
      if (!opts.ok) {
        setFlash({ ok: false, text: opts.error });
        setMode({ kind: "idle" });
        return;
      }
      setMode({
        kind: "picking",
        action: { type: "reschedule", lessonId, hasSlots: opts.slots.length > 0 },
        subjectName: opts.lesson.subjectName,
        slots: opts.slots,
        picked: null,
      });
      jumpToFirstSlot(opts.slots);
    });
  }

  function openCreditRedemption(creditId: string) {
    startLoad(async () => {
      const res = await loadCreditRedemption(creditId, studentId);
      if (!res.ok) {
        setFlash({ ok: false, text: res.error });
        setMode({ kind: "idle" });
        return;
      }
      setMode({
        kind: "picking",
        action: { type: "credit", creditId },
        subjectName: res.subjectName,
        slots: res.slots,
        picked: null,
      });
      jumpToFirstSlot(res.slots);
    });
  }

  function confirm() {
    if (!picking?.picked) return;
    const s = picking.picked;
    const slot = `${s.tutorId}|${s.date}|${s.startTime}|${s.endTime}`;
    const action = picking.action;
    startSubmit(async () => {
      let res: { ok: true; message: string } | { ok: false; error: string };
      if (action.type === "reschedule") {
        const fd = new FormData();
        fd.set("lessonId", action.lessonId);
        fd.set("slot", slot);
        if (studentId) fd.set("studentId", studentId);
        res = await submitReschedule(fd);
      } else {
        const fd = new FormData();
        fd.set("creditId", action.creditId);
        fd.set("slot", slot);
        if (studentId) fd.set("studentId", studentId);
        res = await redeemCredit(fd);
      }
      setMode({ kind: "idle" });
      setFlash(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  }

  function useCreditInstead() {
    if (picking?.action.type !== "reschedule") return;
    const lessonId = picking.action.lessonId;
    const fd = new FormData();
    fd.set("lessonId", lessonId);
    if (studentId) fd.set("studentId", studentId);
    startSubmit(async () => {
      const res = await grantRescheduleCredit(fd);
      setMode({ kind: "idle" });
      setFlash(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  }

  function confirmCancel() {
    if (!cancelConfirming) return;
    const fd = new FormData();
    fd.set("lessonId", cancelConfirming.lessonId);
    if (studentId) fd.set("studentId", studentId);
    startSubmit(async () => {
      const res = await cancelLesson(fd);
      setMode({ kind: "idle" });
      setFlash(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {flash && (
        <div
          className={cn(
            "rounded-[12px] border px-4 py-2.5 text-[13px] font-bold",
            flash.ok
              ? "border-good/40 bg-good-bg text-good"
              : "border-bad/40 bg-bad-bg text-bad",
          )}
        >
          {flash.text}
        </div>
      )}

      {picking && (
        <div className="sticky top-4 z-30 flex items-center justify-between gap-3 rounded-[12px] border border-brand-300 bg-brand-50 px-4 py-2.5 shadow-sm">
          <div className="text-[13px] font-bold text-brand-800">
            {picking.picked ? (
              <>
                {picking.action.type === "credit" ? "Book" : "Move"}{" "}
                {picking.subjectName}{" "}
                {picking.action.type === "credit" ? "make-up at" : "to"}{" "}
                <span className="tabular-nums">
                  {new Date(
                    `${picking.picked.date}T00:00:00`,
                  ).toLocaleDateString("en-AU", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  {formatTime(picking.picked.startTime)}
                </span>
                ?
              </>
            ) : (
              <>
                {picking.action.type === "credit"
                  ? `Pick a time for your ${picking.subjectName} credit`
                  : `Pick a new time for ${picking.subjectName}`}{" "}
                - open slots are highlighted.
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {picking.picked && (
              <button
                type="button"
                onClick={confirm}
                disabled={submitting}
                className={cn(
                  "min-h-11 rounded-[10px] bg-brand-500 px-4 text-[13px] font-bold text-white hover:bg-brand-600 disabled:opacity-50",
                  FOCUS_RING,
                )}
              >
                {submitting
                  ? "…"
                  : picking.action.type === "credit"
                    ? "Book with credit"
                    : "Confirm reschedule"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode({ kind: "idle" })}
              className={cn(
                "min-h-11 rounded-[10px] px-3 text-[12px] font-bold text-brand-700 hover:text-brand-900",
                FOCUS_RING,
              )}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {picking && picking.action.type === "reschedule" && !picking.action.hasSlots && (
        <div className="rounded-[12px] border border-line bg-surface px-4 py-3">
          <div className="text-[13px] text-muted">
            Your tutor has no open slots in the next few weeks. Please contact
            the office, or convert this lesson to a class credit instead.
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={useCreditInstead}
              disabled={submitting}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-[12px] bg-brand-500 px-5 text-[14px] font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-50",
                FOCUS_RING,
              )}
            >
              {submitting ? "Working…" : "Get a class credit instead"}
            </button>
            {adminId && (
              <Link
                href={`${messageBase}/${adminId}`}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center rounded-[12px] border border-line bg-surface px-5 text-[14px] font-bold text-ink transition-colors hover:border-brand-300",
                  FOCUS_RING,
                )}
              >
                Message the office
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink tabular-nums">
          {MONTH_NAMES[view.month]} {view.year}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navMonth(-1)}
            aria-label="Previous month"
            className={cn(
              "h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft hover:border-brand-300 hover:text-ink transition-colors",
              FOCUS_RING,
            )}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => navMonth(1)}
            aria-label="Next month"
            className={cn(
              "h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft hover:border-brand-300 hover:text-ink transition-colors",
              FOCUS_RING,
            )}
          >
            ›
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface-2/60 p-1.5">
        <div className="grid grid-cols-7 gap-0 mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-2 font-bold">
          {DAY_LABELS.map((d, i) => (
            <div key={d} className={cn("text-center py-2", (i === 5 || i === 6) && "text-muted")}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {visibleDays.map((d) => (
            <div
              key={d.iso}
              className={cn(
                "min-h-[140px] lg:min-h-[160px] rounded-xl border flex flex-col transition-colors",
                !d.inMonth
                  ? "border-line/40 bg-surface-2/40"
                  : d.isToday
                    ? "border-brand-400 bg-surface ring-1 ring-brand-300/40"
                    : "border-line bg-surface",
              )}
            >
              <div className="px-2.5 pt-2 pb-1.5">
                <span
                  className={cn(
                    "text-[15px] font-bold tabular-nums leading-none",
                    d.isToday ? "text-brand-700" : d.inMonth ? "text-ink" : "text-muted-2/60",
                  )}
                >
                  {d.dayNum}
                </span>
              </div>
              <div className="px-1.5 pb-1.5 flex-1 space-y-1 overflow-visible">
                {(lessonsByDate.get(d.iso) ?? []).map((l) => (
                  <LessonChip
                    key={l.id}
                    lesson={l}
                    dimmed={!d.inMonth}
                    picking={!!picking}
                    menuOpen={mode.kind === "menu" && mode.lessonId === l.id}
                    cancelConfirming={
                      mode.kind === "cancel-confirm" && mode.lessonId === l.id
                    }
                    loading={loading}
                    cancelling={submitting}
                    adminId={adminId}
                    subjectBase={subjectBase}
                    subjectQuery={subjectQuery}
                    messageBase={messageBase}
                    onOpenMenu={() => setMode({ kind: "menu", lessonId: l.id })}
                    onCloseMenu={() => setMode({ kind: "idle" })}
                    onReschedule={() => openReschedule(l.id)}
                    onOpenCancelConfirm={() =>
                      setMode({ kind: "cancel-confirm", lessonId: l.id })
                    }
                    onAbortCancel={() => setMode({ kind: "menu", lessonId: l.id })}
                    onConfirmCancel={confirmCancel}
                  />
                ))}
                {picking &&
                  (slotsByDate.get(d.iso) ?? []).map((s) => {
                    if (s.taken) {
                      return (
                        <div
                          key={`${s.date}-${s.startTime}`}
                          aria-disabled="true"
                          title="This tutor is already booked at this time"
                          className="block w-full rounded-md px-2 py-1 leading-tight border border-line bg-surface-2 text-muted opacity-70 cursor-not-allowed"
                        >
                          <div className="text-[10px] font-extrabold tabular-nums line-through">
                            {formatTime(s.startTime)}
                          </div>
                          <div className="text-[10px] font-bold truncate uppercase tracking-wide">
                            Taken
                          </div>
                        </div>
                      );
                    }
                    const active =
                      picking.picked?.date === s.date &&
                      picking.picked?.startTime === s.startTime;
                    return (
                      <button
                        type="button"
                        key={`${s.date}-${s.startTime}`}
                        onClick={() =>
                          setMode({ ...picking, picked: s })
                        }
                        className={cn(
                          "block w-full text-left rounded-md px-2 py-1 leading-tight border transition-colors",
                          active
                            ? "bg-brand-500 border-brand-500 text-white"
                            : "bg-good-bg border-good/40 text-good hover:brightness-95",
                          FOCUS_RING,
                        )}
                      >
                        <div className="text-[10px] font-extrabold tabular-nums">
                          {formatTime(s.startTime)}
                        </div>
                        <div className="text-[10px] font-bold truncate opacity-90">
                          Open
                        </div>
                      </button>
                    );
                  })}
                {(hwByDate.get(d.iso) ?? []).map((h) => (
                  <Link
                    key={h.id}
                    href={homeworkHref(h)}
                    className={cn(
                      "block rounded-md px-2 py-1 leading-tight text-[11px] font-bold truncate",
                      picking && "opacity-40",
                      h.done ? "bg-good-bg text-good" : "bg-warn-bg text-warn",
                    )}
                  >
                    {h.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {credits.length > 0 && (
        <div className="rounded-[14px] border border-line bg-surface">
          <div className="border-b border-line px-4 py-3.5">
            <h3 className="m-0 text-[14px] font-bold text-ink">Class credits</h3>
          </div>
          <div className="divide-y divide-line">
            {credits.map((c) => {
              const active =
                picking?.action.type === "credit" &&
                picking.action.creditId === c.id;
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="text-[13px] font-bold text-ink">{c.subjectName}</div>
                    <div className="text-[12px] text-muted">
                      Expires {formatDateLong(c.expiresAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreditRedemption(c.id)}
                    disabled={loading || submitting || !!picking}
                    className={cn(
                      "shrink-0 min-h-11 rounded-[10px] bg-brand-500 px-4 text-[13px] font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-50",
                      FOCUS_RING,
                    )}
                  >
                    {active ? "Picking a slot…" : "Use credit"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LessonChip({
  lesson,
  dimmed,
  picking,
  menuOpen,
  cancelConfirming,
  loading,
  cancelling,
  adminId,
  subjectBase,
  subjectQuery,
  messageBase,
  onOpenMenu,
  onCloseMenu,
  onReschedule,
  onOpenCancelConfirm,
  onAbortCancel,
  onConfirmCancel,
}: {
  lesson: TimetableChip;
  dimmed: boolean;
  picking: boolean;
  menuOpen: boolean;
  cancelConfirming: boolean;
  loading: boolean;
  cancelling: boolean;
  adminId: string | null;
  subjectBase: string;
  subjectQuery: string;
  messageBase: string;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onReschedule: () => void;
  onOpenCancelConfirm: () => void;
  onAbortCancel: () => void;
  onConfirmCancel: () => void;
}) {
  // Dismiss the open menu / cancel-confirm on a click anywhere outside this
  // cell, or on Escape - not only via the explicit Close button.
  const popRef = useRef<HTMLDivElement>(null);
  const popoverOpen = menuOpen || cancelConfirming;
  useEffect(() => {
    if (!popoverOpen) return;
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        onCloseMenu();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseMenu();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popoverOpen, onCloseMenu]);

  const cancelled = lesson.cancelled;
  const moved = lesson.studentState === "moved_out";
  const makeup = lesson.studentState === "makeup_in";
  const pending =
    lesson.studentState === "pending_in" || lesson.studentState === "pending_out";
  const tone = cancelled
    ? "bg-bad-bg text-bad"
    : moved
      ? "bg-surface-2 text-muted"
      : makeup
        ? "bg-good-bg text-good"
        : pending
          ? "bg-warn-bg text-warn border border-dashed border-warn/50"
          : "bg-brand-50 text-brand-700";
  const struck = cancelled || moved;

  const chip = (
    <div
      className={cn(
        "relative rounded-md pl-2 pr-1.5 py-1 leading-tight overflow-hidden",
        tone,
        (dimmed || (picking && !menuOpen && !cancelConfirming)) && "opacity-40",
        !picking && "cursor-pointer hover:brightness-95",
      )}
    >
      <div className={cn("text-[10px] font-extrabold tabular-nums", struck && "line-through")}>
        {formatTime(lesson.startTime)}
      </div>
      <div className={cn("mt-0.5 text-[11px] truncate font-bold", struck && "line-through")}>
        {lesson.subjectName}
      </div>
      {cancelled ? (
        <div className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wide truncate">
          Cancelled
        </div>
      ) : lesson.moveLabel ? (
        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide truncate">
          {lesson.moveLabel}
        </div>
      ) : null}
    </div>
  );

  if (picking) return chip;

  // Show the office escape when at least one action is gated for a reason the
  // office can act on (notice window or cap) - not for a passed/already-done
  // lesson, where it can't help.
  const showOfficeLink =
    !!adminId && (!lesson.canReschedule || !lesson.canCancel);
  const messageOfficeLink = showOfficeLink ? (
    <Link
      href={`${messageBase}/${adminId}`}
      className={cn(
        "flex min-h-11 w-full items-center rounded-md px-2.5 text-[12px] font-bold text-brand-600 hover:bg-brand-50",
        FOCUS_RING,
      )}
    >
      Message the office
    </Link>
  ) : null;

  const disabledRow =
    "flex min-h-11 w-full items-center rounded-md px-2.5 text-left text-[12px] font-semibold text-muted opacity-70 cursor-not-allowed";

  return (
    <div ref={popRef} className="relative">
      <button type="button" onClick={onOpenMenu} className={cn("block w-full text-left", FOCUS_RING)}>
        {chip}
      </button>
      {menuOpen && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 origin-top scale-100 rounded-[10px] border border-line bg-surface p-1 shadow-lg">
          <Link
            href={`${subjectBase}/${lesson.subjectId}${subjectQuery}`}
            className={cn(
              "block rounded-md px-2.5 py-1.5 text-[12px] font-bold text-ink hover:bg-surface-2",
              FOCUS_RING,
            )}
          >
            Go to subject
          </Link>

          {cancelled ? (
            <div
              className="flex min-h-11 w-full items-center rounded-md px-2.5 text-[12px] font-bold text-bad"
              aria-disabled="true"
            >
              Cancelled
            </div>
          ) : (
            <>
              {lesson.canReschedule ? (
                <button
                  type="button"
                  onClick={onReschedule}
                  disabled={loading}
                  className={cn(
                    "flex min-h-11 w-full items-center rounded-md px-2.5 text-left text-[12px] font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-50",
                    FOCUS_RING,
                  )}
                >
                  {loading
                    ? "Loading…"
                    : `Reschedule (${lesson.rescheduleRemaining} of ${lesson.rescheduleCap} left)`}
                </button>
              ) : (
                <div className={disabledRow} aria-disabled="true">
                  Reschedule - {lesson.rescheduleReason ?? "unavailable"}
                </div>
              )}

              {lesson.canCancel ? (
                <button
                  type="button"
                  onClick={onOpenCancelConfirm}
                  className={cn(
                    "flex min-h-11 w-full items-center rounded-md px-2.5 text-left text-[12px] font-bold text-bad hover:bg-bad-bg",
                    FOCUS_RING,
                  )}
                >
                  {`Cancel (${lesson.cancelRemaining} of ${lesson.cancelCap} left)`}
                </button>
              ) : (
                <div className={disabledRow} aria-disabled="true">
                  Cancel - {lesson.cancelReason ?? "unavailable"}
                </div>
              )}

              {messageOfficeLink}
            </>
          )}

          <button
            type="button"
            onClick={onCloseMenu}
            className={cn(
              "block w-full rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold text-muted hover:bg-surface-2",
              FOCUS_RING,
            )}
          >
            Close
          </button>
        </div>
      )}
      {cancelConfirming && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-[10px] border border-bad/40 bg-surface p-2.5 shadow-lg">
          <div className="text-[11px] font-semibold text-ink">
            This uses 1 of your {lesson.cancelCap} term cancellations and adds a
            class credit.
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onAbortCancel}
              className={cn(
                "min-h-11 rounded-md px-3 text-[11px] font-bold text-muted hover:bg-surface-2",
                FOCUS_RING,
              )}
            >
              Back
            </button>
            <button
              type="button"
              onClick={onConfirmCancel}
              disabled={cancelling}
              className={cn(
                "min-h-11 rounded-md bg-bad px-3 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-50",
                FOCUS_RING,
              )}
            >
              {cancelling ? "Cancelling…" : "Cancel lesson"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
