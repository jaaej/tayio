"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import {
  loadRescheduleOptions,
  submitReschedule,
  type RescheduleOptions,
  type RescheduleSlot,
} from "@/app/_actions/reschedule";

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
  canReschedule: boolean;
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

type LoadedOptions = Extract<RescheduleOptions, { ok: true }>;
type Mode =
  | { kind: "idle" }
  | { kind: "menu"; lessonId: string }
  | {
      kind: "picking";
      lessonId: string;
      opts: LoadedOptions;
      picked: RescheduleSlot | null;
    };

export function InteractiveTimetable({
  initialYear,
  initialMonth,
  lessons,
  homework,
  adminId,
}: {
  initialYear: number;
  initialMonth: number;
  lessons: TimetableChip[];
  homework: TimetableHw[];
  /** Admin office profile id to message when no reschedule slot is
   *  available. Null if no admin contact is available (empty state
   *  falls back to plain text with no link). */
  adminId: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState({ year: initialYear, month: initialMonth });
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [loading, startLoad] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const picking = mode.kind === "picking" ? mode : null;

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
      for (const s of picking.opts.slots)
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

  function openReschedule(lessonId: string) {
    startLoad(async () => {
      const opts = await loadRescheduleOptions(lessonId);
      if (!opts.ok) {
        setFlash({ ok: false, text: opts.error });
        setMode({ kind: "idle" });
        return;
      }
      setMode({ kind: "picking", lessonId, opts, picked: null });
      if (opts.slots.length > 0) {
        const first = opts.slots.reduce((a, b) => (a.date <= b.date ? a : b));
        const d = new Date(`${first.date}T00:00:00`);
        setView({ year: d.getFullYear(), month: d.getMonth() });
      }
    });
  }

  function confirm() {
    if (!picking?.picked) return;
    const s = picking.picked;
    const fd = new FormData();
    fd.set("lessonId", picking.lessonId);
    fd.set("slot", `${s.tutorId}|${s.date}|${s.startTime}|${s.endTime}`);
    startSubmit(async () => {
      const res = await submitReschedule(fd);
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
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-brand-300 bg-brand-50 px-4 py-2.5">
          <div className="text-[13px] font-bold text-brand-800">
            Pick a new time for {picking.opts.lesson.subjectName} — tutor's open
            slots are highlighted.
            {picking.opts.approvalRequired && (
              <span className="font-semibold text-brand-700">
                {picking.opts.secondReschedule
                  ? " Second reschedule — needs tutor/admin approval."
                  : " This will be sent for approval."}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMode({ kind: "idle" })}
            className="shrink-0 text-[12px] font-bold text-brand-700 hover:text-brand-900"
          >
            Cancel
          </button>
        </div>
      )}

      {picking && picking.opts.slots.length === 0 && (
        <div className="rounded-[12px] border border-line bg-surface px-4 py-3">
          <div className="text-[13px] text-muted">
            Your tutor has no open slots in the next few weeks. Please contact
            the office.
          </div>
          {adminId && (
            <Link
              href={`/student/messages/with/${adminId}`}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[12px] bg-brand-500 px-5 text-[14px] font-bold text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
            >
              Message the office
            </Link>
          )}
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
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft hover:border-brand-300 hover:text-ink transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => navMonth(1)}
            aria-label="Next month"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft hover:border-brand-300 hover:text-ink transition-colors"
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
                    loading={loading}
                    onOpenMenu={() => setMode({ kind: "menu", lessonId: l.id })}
                    onCloseMenu={() => setMode({ kind: "idle" })}
                    onReschedule={() => openReschedule(l.id)}
                  />
                ))}
                {picking &&
                  (slotsByDate.get(d.iso) ?? []).map((s) => {
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
                    href={`/student/homework/${h.id}`}
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

      {picking?.picked && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-[14px] border border-brand-300 bg-surface px-4 py-3 shadow-lg">
          <div className="text-[13px] text-ink">
            Move to{" "}
            <span className="font-bold">
              {new Date(`${picking.picked.date}T00:00:00`).toLocaleDateString(
                "en-AU",
                { weekday: "short", day: "numeric", month: "short" },
              )}{" "}
              {formatTime(picking.picked.startTime)}
            </span>
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting}
            className="rounded-[10px] bg-brand-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting
              ? "…"
              : picking.opts.approvalRequired
                ? "Request reschedule"
                : "Confirm reschedule"}
          </button>
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
  loading,
  onOpenMenu,
  onCloseMenu,
  onReschedule,
}: {
  lesson: TimetableChip;
  dimmed: boolean;
  picking: boolean;
  menuOpen: boolean;
  loading: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onReschedule: () => void;
}) {
  const moved = lesson.studentState === "moved_out";
  const makeup = lesson.studentState === "makeup_in";
  const pending =
    lesson.studentState === "pending_in" || lesson.studentState === "pending_out";
  const tone = moved
    ? "bg-surface-2 text-muted"
    : makeup
      ? "bg-good-bg text-good"
      : pending
        ? "bg-warn-bg text-warn border border-dashed border-warn/50"
        : "bg-brand-50 text-brand-700";

  const chip = (
    <div
      className={cn(
        "relative rounded-md pl-2 pr-1.5 py-1 leading-tight overflow-hidden",
        tone,
        (dimmed || (picking && !menuOpen)) && "opacity-40",
        lesson.canReschedule && !picking && "cursor-pointer hover:brightness-95",
      )}
    >
      <div className={cn("text-[10px] font-extrabold tabular-nums", moved && "line-through")}>
        {formatTime(lesson.startTime)}
      </div>
      <div className={cn("mt-0.5 text-[11px] truncate font-bold", moved && "line-through")}>
        {lesson.subjectName}
      </div>
      {lesson.moveLabel && (
        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide truncate">
          {lesson.moveLabel}
        </div>
      )}
    </div>
  );

  if (!lesson.canReschedule || picking) return chip;

  return (
    <div className="relative">
      <button type="button" onClick={onOpenMenu} className="block w-full text-left">
        {chip}
      </button>
      {menuOpen && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 origin-top scale-100 rounded-[10px] border border-line bg-surface p-1 shadow-lg">
          <Link
            href={`/student/subjects/${lesson.subjectId}`}
            className="block rounded-md px-2.5 py-1.5 text-[12px] font-bold text-ink hover:bg-surface-2"
          >
            Go to subject
          </Link>
          <button
            type="button"
            onClick={onReschedule}
            disabled={loading}
            className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12px] font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Reschedule"}
          </button>
          <button
            type="button"
            onClick={onCloseMenu}
            className="block w-full rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold text-muted hover:bg-surface-2"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
