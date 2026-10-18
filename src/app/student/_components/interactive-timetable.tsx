"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateLong, formatTime, formatTimeRange } from "@/lib/format";
import { distinctSubjects } from "@/lib/subject-label";
import { subjectTone } from "@/lib/subject-tone";
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
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { GlassPanel, SubjectDot, buttonVariants } from "@/components/admin/ui";
import { MonthGrid, type MonthChip } from "@/components/calendar/month-grid";
import { defaultSelectedLessonId } from "./timetable-helpers";

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
  subjectYearLevel: string | null;
  /** The subject's stored colour (`subjects.color`). */
  subjectColor: string | null;
  className: string;
  location: string | null;
  /** The lesson's tutor; null on a synthetic pending chip. */
  tutorName: string | null;
  studentState:
    | "normal"
    | "moved_out"
    | "makeup_in"
    | "pending_out"
    | "pending_in";
  moveLabel: string | null;
  /** Base eligibility - lesson is upcoming, in the future, and in a state
   *  self-serve actions make sense for. Every lesson can be selected; this
   *  only gates whether the reschedule/cancel actions are live vs shown
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
  /** Effective per-term caps (base 3 + admin allowance bonus) - the
   *  denominator in the cancel confirmation. */
  rescheduleCap: number;
  cancelCap: number;
  /** When reschedule is unavailable, a short reason ("Passed", "Needs 7 days
   *  notice", ...) shown under the greyed-out action. null when reschedulable. */
  rescheduleReason: string | null;
  /** When cancel is unavailable, a short reason shown under the greyed-out
   *  action. null when cancellable. */
  cancelReason: string | null;
  /** This lesson has been cancelled by the student (a credit was granted). */
  cancelled: boolean;
  /** This lesson was converted to a class credit via a no-slot reschedule
   *  (credit granted from it, but not a cancellation). */
  convertedToCredit: boolean;
  /** The tutor wrote a recap of this lesson for the family. */
  hasRecap?: boolean;
};
export type TimetableHw = {
  id: string;
  dueDate: string;
  title: string;
  done: boolean;
  /** Precomputed link for the due-date chip. Built server-side per portal
   *  (the student's per-item detail page vs the parent's child-filtered
   *  list) so no function crosses the server/client boundary. */
  href: string;
};

/** The two things that share the calendar slot-picking overlay: rescheduling a
 *  lesson, and redeeming a class credit. */
type PickAction =
  | { type: "reschedule"; lessonId: string; hasSlots: boolean }
  | { type: "credit"; creditId: string };
type Mode =
  | { kind: "idle" }
  | { kind: "cancel-confirm"; lessonId: string }
  | {
      kind: "picking";
      action: PickAction;
      subjectName: string;
      slots: RescheduleSlot[];
      picked: RescheduleSlot | null;
    };

const slotKey = (s: RescheduleSlot) => `${s.tutorId}|${s.date}|${s.startTime}`;

function monthParam(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * The month timetable shared by the student's own Timetable page and the
 * parent's per-child Classes page: the shared month grid on the left, and a
 * side rail with the selected lesson, class credits and any extra panels the
 * page passes in. Clicking a lesson selects it; reschedule and cancel act on
 * the selected lesson. `canSelfServe` is false for a student without billing
 * access, who sees the same lesson details but is pointed to a parent.
 */
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
  recapBase = "/student/resources",
  canSelfServe = true,
  glass = false,
  aside,
  initialLessonId,
}: {
  initialYear: number;
  initialMonth: number;
  lessons: TimetableChip[];
  homework: TimetableHw[];
  /** The student's active class credits, redeemed via the same calendar
   *  slot-picking overlay as a reschedule. */
  credits: PanelCredit[];
  /** Admin office profile id to message when an action is blocked or no
   *  reschedule slot is available. Null hides those links. */
  adminId: string | null;
  /** Acting on behalf of this student (parent portal). Undefined on the
   *  student's own timetable, where every action defaults to the caller. */
  studentId?: string;
  /** Base path for the subject link - `${subjectBase}/${lesson.subjectId}${subjectQuery}`. */
  subjectBase?: string;
  /** Query string appended after the subject id, e.g. `?child=${studentId}` so
   *  the parent portal's subject page resolves the same child. */
  subjectQuery?: string;
  /** Base path for "Message the office" links - `${messageBase}/${adminId}`. */
  messageBase?: string;
  /** Base path for a past lesson's recap - `${recapBase}/${lesson.id}${subjectQuery}`. */
  recapBase?: string;
  /** False for a student without billing access: no reschedule, cancel or
   *  credits; the selected lesson says to ask a parent instead. The server
   *  actions enforce the same rule. */
  canSelfServe?: boolean;
  /** Render the calendar and rail in glass frames (portals on the glass
   *  shell). The parent portal, not yet on the glass shell, uses plain cards. */
  glass?: boolean;
  /** Extra rail panels below the selected lesson and credits. */
  aside?: ReactNode;
  /** Open with this lesson selected (a "Can't make it?" link names it);
   *  otherwise the next lesson. */
  initialLessonId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState({ year: initialYear, month: initialMonth });
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialLessonId && lessons.some((l) => l.id === initialLessonId)
      ? initialLessonId
      : defaultSelectedLessonId(lessons, new Date()),
  );
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [loading, startLoad] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const picking = mode.kind === "picking" ? mode : null;
  const selected = lessons.find((l) => l.id === selectedId) ?? null;

  // The page loads a window of months around ?month, so moving the calendar
  // also moves the URL: the server re-centres the window and the month is
  // shareable. Other query params (the parent's ?child=) are kept.
  function showMonth(year: number, month: number) {
    setView({ year, month });
    const params = new URLSearchParams(window.location.search);
    params.set("month", monthParam(year, month));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  function navMonth(delta: number) {
    const d = new Date(view.year, view.month + delta, 1);
    showMonth(d.getFullYear(), d.getMonth());
  }
  function jumpToFirstSlot(slots: RescheduleSlot[]) {
    if (slots.length === 0) return;
    const first = slots.reduce((a, b) => (a.date <= b.date ? a : b));
    const d = new Date(`${first.date}T00:00:00`);
    if (d.getFullYear() !== view.year || d.getMonth() !== view.month) {
      showMonth(d.getFullYear(), d.getMonth());
    }
  }

  function selectLesson(id: string) {
    setSelectedId(id);
    setMode({ kind: "idle" });
    setFlash(null);
    // When the rail sits below the calendar, bring the card into view.
    if (!window.matchMedia("(min-width: 80rem)").matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() =>
        selectedRef.current?.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "nearest",
        }),
      );
    }
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
    if (mode.kind !== "cancel-confirm") return;
    const fd = new FormData();
    fd.set("lessonId", mode.lessonId);
    if (studentId) fd.set("studentId", studentId);
    startSubmit(async () => {
      const res = await cancelLesson(fd);
      setMode({ kind: "idle" });
      setFlash(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  }

  const chips = useMemo<MonthChip[]>(() => {
    const out: MonthChip[] = lessons.map((l) =>
      lessonChip(l, l.id === selectedId && !picking, !!picking),
    );
    if (picking) {
      for (const s of picking.slots) {
        const active = picking.picked ? slotKey(picking.picked) === slotKey(s) : false;
        out.push({
          id: `slot:${slotKey(s)}`,
          date: s.date,
          label: formatTime(s.startTime),
          sublabel: s.taken ? "Taken" : "Open",
          sortKey: `1-${s.startTime}`,
          tone: s.taken
            ? "bg-surface-3 text-muted line-through"
            : active
              ? "bg-[#17152B] text-white"
              : "bg-good-bg text-good ring-1 ring-inset ring-good/40",
          interactive: !s.taken,
          pressed: active,
          title: s.taken ? "This tutor is already booked at this time" : undefined,
        });
      }
    }
    for (const h of homework) {
      out.push({
        id: `hw:${h.id}`,
        date: h.dueDate,
        label: "Due",
        sublabel: h.title,
        sortKey: `2-${h.title}`,
        tone: cn(
          "rounded-[8px] border border-dashed border-[#E8B66A] bg-white text-[#8A4A06]",
          h.done && "opacity-60",
        ),
        href: h.href,
        dimmed: !!picking,
        title: `${h.title} - ${h.done ? "handed in" : "due"}`,
      });
    }
    return out;
  }, [lessons, homework, selectedId, picking]);

  function onChipClick(id: string) {
    if (id.startsWith("lesson:") && !picking) selectLesson(id.slice("lesson:".length));
    if (id.startsWith("slot:") && picking) {
      const s = picking.slots.find((x) => `slot:${slotKey(x)}` === id);
      if (s && !s.taken) setMode({ ...picking, picked: s });
    }
  }

  const navButton = cn(
    buttonVariants({ variant: glass ? "glass" : "outline", size: "icon" }),
    "h-9 w-9 rounded-[10px]",
  );
  const monthNav = (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => navMonth(-1)} aria-label="Previous month" className={navButton}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => {
          const now = new Date();
          showMonth(now.getFullYear(), now.getMonth());
        }}
        className={cn(
          buttonVariants({ variant: glass ? "glass" : "outline" }),
          "h-9 rounded-[10px] px-3 text-[13px] font-bold",
        )}
      >
        Today
      </button>
      <button type="button" onClick={() => navMonth(1)} aria-label="Next month" className={navButton}>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
  // One entry per subject: each subject has its own colour.
  const legendSubjects = distinctSubjects(
    lessons.map((l) => ({
      id: l.subjectId,
      name: l.subjectName,
      yearLevel: l.subjectYearLevel,
      color: l.subjectColor,
    })),
  );
  const legend = (
    <div className="flex flex-wrap gap-3.5 px-2.5 pb-1.5 pt-2.5 text-[12px] font-semibold text-[#2E2944]">
      {legendSubjects.map(({ id, name, label, color }) => (
        <span key={id} className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-[4px]"
            style={{ backgroundColor: subjectTone(name, color).bg }}
          />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[4px] border border-dashed border-[#E8B66A]" />
        Homework due
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[4px] bg-[#E3F4EC]" />
        Make-up
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[4px] bg-[#F1F2F7]" />
        Cancelled
      </span>
    </div>
  );
  const monthTitle = (
    <span className="tabular-nums">
      {MONTH_NAMES[view.month]} <span className="font-medium text-[#2E2944]">{view.year}</span>
    </span>
  );

  return (
    <div className="space-y-5">
      {flash && (
        <div
          role="status"
          className={cn(
            "rounded-[12px] px-4 py-2.5 text-[13px] font-bold",
            flash.ok ? "bg-good-bg text-good" : "bg-bad-bg text-bad",
          )}
        >
          {flash.text}
        </div>
      )}

      {picking && (
        <div
          className={cn(
            "sticky top-[72px] z-30 flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-4 py-2.5 lg:top-[76px]",
            glass ? "glass" : "border border-line bg-surface shadow-sm",
          )}
        >
          <p className="text-[13px] font-bold text-ink">
            {picking.picked ? (
              <>
                {picking.action.type === "credit" ? "Book" : "Move"} {picking.subjectName}{" "}
                {picking.action.type === "credit" ? "make-up at" : "to"}{" "}
                <span className="tabular-nums">
                  {new Date(`${picking.picked.date}T00:00:00`).toLocaleDateString("en-AU", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  {formatTime(picking.picked.startTime)}
                </span>
                ?
              </>
            ) : picking.slots.length > 0 ? (
              picking.action.type === "credit"
                ? `Pick a time on the calendar for your ${picking.subjectName} credit.`
                : `Pick a new time on the calendar for ${picking.subjectName}.`
            ) : (
              `No open times for ${picking.subjectName} in the next few weeks.`
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {picking.picked && (
              <button
                type="button"
                onClick={confirm}
                disabled={submitting}
                className={buttonVariants({ variant: "primary" })}
              >
                <ActionButtonLabel pending={submitting} pendingLabel="Saving…">
                  {picking.action.type === "credit" ? "Book with credit" : "Confirm reschedule"}
                </ActionButtonLabel>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode({ kind: "idle" })}
              className={buttonVariants({ variant: glass ? "glass" : "outline" })}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {picking && picking.action.type === "reschedule" && !picking.action.hasSlots && (
        <div className="rounded-[16px] border border-line bg-surface px-4 py-3">
          <p className="text-[13px] text-ink-soft">
            Your tutor has no open slots in the next few weeks. Contact the
            office, or turn this lesson into a class credit instead.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={useCreditInstead}
              disabled={submitting}
              className={buttonVariants({ variant: "primary" })}
            >
              <ActionButtonLabel pending={submitting} pendingLabel="Working…">
                Get a class credit instead
              </ActionButtonLabel>
            </button>
            {adminId && (
              <Link href={`${messageBase}/${adminId}`} className={buttonVariants({ variant: "outline" })}>
                Message the office
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        {glass ? (
          <section
            aria-labelledby="timetable-month"
            className="glass min-w-0 flex-[999_1_640px] rounded-[24px] p-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 pl-3 pr-1.5 pt-1.5">
              <h2 id="timetable-month" className="text-[20px] font-extrabold text-[#17152B]">
                {monthTitle}
              </h2>
              {monthNav}
            </div>
            <MonthGrid year={view.year} month={view.month} chips={chips} onChipClick={onChipClick} />
            {legend}
          </section>
        ) : (
          <section aria-labelledby="timetable-month" className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="timetable-month" className="text-[20px] font-extrabold text-ink">
                {monthTitle}
              </h2>
              {monthNav}
            </div>
            <MonthGrid year={view.year} month={view.month} chips={chips} onChipClick={onChipClick} />
            {legend}
          </section>
        )}

        <div className="flex min-w-[280px] max-w-[360px] flex-[1_1_300px] flex-col gap-5 max-sm:min-w-0 max-sm:max-w-none">
          <RailCard glass={glass} title="Selected lesson" titleId="timetable-selected">
            <div ref={selectedRef} className="scroll-mt-24">
              {selected ? (
                <SelectedLesson
                  lesson={selected}
                  canSelfServe={canSelfServe}
                  busy={loading || submitting || !!picking}
                  loading={loading}
                  submitting={submitting}
                  confirmingCancel={mode.kind === "cancel-confirm" && mode.lessonId === selected.id}
                  picking={picking?.action.type === "reschedule" && picking.action.lessonId === selected.id}
                  adminId={adminId}
                  subjectHref={
                    selected.subjectId ? `${subjectBase}/${selected.subjectId}${subjectQuery}` : null
                  }
                  messageHref={adminId ? `${messageBase}/${adminId}` : null}
                  recapHref={selected.hasRecap ? `${recapBase}/${selected.id}${subjectQuery}` : null}
                  onReschedule={() => openReschedule(selected.id)}
                  onCancel={() => setMode({ kind: "cancel-confirm", lessonId: selected.id })}
                  onAbortCancel={() => setMode({ kind: "idle" })}
                  onConfirmCancel={confirmCancel}
                />
              ) : (
                <p className="p-4 text-[13px] text-muted">
                  Select a lesson on the calendar to see its details.
                </p>
              )}
            </div>
          </RailCard>

          {canSelfServe && credits.length > 0 && (
            <RailCard glass={glass} title="Class credits" titleId="timetable-credits">
              <ul className="p-1.5">
                {credits.map((c) => {
                  const active = picking?.action.type === "credit" && picking.action.creditId === c.id;
                  return (
                    <li key={c.id} className="flex items-center gap-2.5 p-2.5">
                      <SubjectDot subject={c.subjectName} color={c.subjectColor} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[14px] font-bold text-[#17152B]">{c.subjectName}</span>
                        <span className="text-[12px] text-[#5E5A73]">Expires {formatDateLong(c.expiresAt)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreditRedemption(c.id)}
                        disabled={loading || submitting || !!picking}
                        className="h-8 rounded-[9px] border border-[#DFE1EC] bg-white px-2.5 text-[12px] font-bold text-[#17152B] hover:bg-[#F5F6FA] disabled:opacity-50"
                      >
                        {active ? "Picking a time…" : "Use credit"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </RailCard>
          )}

          {aside}
        </div>
      </div>
    </div>
  );
}

/** A rail section: a glass frame on the glass shell, a plain card elsewhere. */
export function RailCard({
  glass,
  title,
  titleId,
  children,
}: {
  glass: boolean;
  title: string;
  titleId: string;
  children: ReactNode;
}) {
  if (glass) {
    return (
      <GlassPanel title={title} titleId={titleId}>
        {children}
      </GlassPanel>
    );
  }
  return (
    <section aria-labelledby={titleId} className="min-w-0 overflow-hidden rounded-[14px] border border-line bg-surface">
      <h3 id={titleId} className="border-b border-line px-4 py-3 text-[14px] font-extrabold text-ink">
        {title}
      </h3>
      {children}
    </section>
  );
}

function lessonChip(l: TimetableChip, selected: boolean, picking: boolean): MonthChip {
  const off = l.cancelled || l.convertedToCredit || l.studentState === "moved_out";
  const status = l.cancelled
    ? "Cancelled"
    : l.convertedToCredit
      ? "Class credit"
      : l.studentState === "makeup_in"
        ? "Make-up"
        : l.studentState === "pending_in"
          ? "Waiting for approval"
          : l.studentState === "pending_out"
            ? "Move pending"
            : l.studentState === "moved_out"
              ? "Moved"
              : null;
  // Design handoff tones: subject colour for lessons, green for a make-up,
  // grey struck-through for a cancelled or moved lesson.
  const subject = subjectTone(l.subjectName, l.subjectColor);
  const colours = off
    ? { bg: "#F1F2F7", fg: "#5E5A73" }
    : l.studentState === "makeup_in"
      ? { bg: "#E3F4EC", fg: "#15803D" }
      : { bg: subject.bg, fg: subject.fg };
  return {
    id: `lesson:${l.id}`,
    date: l.date,
    label: formatTime(l.startTime),
    sublabel: status ? `${l.subjectName} · ${status}` : l.subjectName,
    sortKey: `0-${l.startTime}`,
    tone: cn(
      "rounded-[8px]",
      off && "line-through",
      l.studentState === "pending_in" && "opacity-70",
      selected && "ring-2 ring-inset ring-[#17152B]",
    ),
    style: { backgroundColor: colours.bg, color: colours.fg },
    dimmed: picking,
    interactive: !picking,
    pressed: selected,
    title: [l.subjectName, formatTimeRange(l.startTime, l.endTime), l.location, l.tutorName, status]
      .filter(Boolean)
      .join(" · "),
    ariaLabel: `${l.subjectName}, ${formatTime(l.startTime)}${status ? `, ${status}` : ""}`,
  };
}

function SelectedLesson({
  lesson,
  canSelfServe,
  busy,
  loading,
  submitting,
  confirmingCancel,
  picking,
  adminId,
  subjectHref,
  messageHref,
  recapHref,
  onReschedule,
  onCancel,
  onAbortCancel,
  onConfirmCancel,
}: {
  lesson: TimetableChip;
  canSelfServe: boolean;
  busy: boolean;
  loading: boolean;
  submitting: boolean;
  confirmingCancel: boolean;
  picking: boolean;
  adminId: string | null;
  subjectHref: string | null;
  messageHref: string | null;
  recapHref: string | null;
  onReschedule: () => void;
  onCancel: () => void;
  onAbortCancel: () => void;
  onConfirmCancel: () => void;
}) {
  const date = new Date(`${lesson.date}T00:00:00`);
  const weekday = date.toLocaleDateString("en-AU", { weekday: "short" });
  const detail = [formatTimeRange(lesson.startTime, lesson.endTime), lesson.location, lesson.tutorName]
    .filter(Boolean)
    .join(" · ");
  const status = lesson.cancelled
    ? "Cancelled. A class credit was added."
    : lesson.convertedToCredit
      ? "Turned into a class credit."
      : lesson.moveLabel;
  const settled = lesson.cancelled || lesson.convertedToCredit;
  // Offer the office when an action is blocked for a reason the office can
  // act on (notice window or cap), not for a passed lesson.
  const showOffice =
    canSelfServe &&
    !!adminId &&
    !settled &&
    (!lesson.canReschedule || !lesson.canCancel) &&
    lesson.rescheduleReason !== "Passed";

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <div className="flex w-[46px] shrink-0 flex-col items-center leading-[1.1]">
          <span className="text-[11px] font-extrabold uppercase text-[#5E5A73]">{weekday}</span>
          <span className="text-[20px] font-extrabold tabular-nums text-[#17152B]">{date.getDate()}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[15px] font-extrabold text-[#17152B]">
            <SubjectDot subject={lesson.subjectName} color={lesson.subjectColor} />
            <span className="truncate">{lesson.subjectName}</span>
          </div>
          <p className="text-[13px] text-[#5E5A73]">{detail}</p>
        </div>
      </div>

      {status && <p className="text-[13px] font-semibold text-ink-soft">{status}</p>}

      {!canSelfServe ? (
        <p className="flex gap-2.5 rounded-[12px] bg-[#F4F5F9] px-3 py-2.5 text-[13px] leading-[1.45] text-[#2E2944]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden />
          Can’t make it? Ask a parent to reschedule or cancel from their portal.
        </p>
      ) : settled ? null : confirmingCancel ? (
        <div className="space-y-3 rounded-[12px] bg-bad-bg px-3 py-3">
          <p className="text-[13px] font-semibold text-ink">
            This uses 1 of your {lesson.cancelCap} cancellations this term and
            adds a class credit.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onAbortCancel} className={buttonVariants({ variant: "outline" })}>
              Keep lesson
            </button>
            <button
              type="button"
              onClick={onConfirmCancel}
              disabled={submitting}
              className={cn(buttonVariants({ variant: "primary" }), "border-bad bg-bad hover:bg-bad/90")}
            >
              <ActionButtonLabel pending={submitting} pendingLabel="Cancelling…">
                Cancel lesson
              </ActionButtonLabel>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onReschedule}
              disabled={!lesson.canReschedule || busy}
              className="h-[38px] rounded-[10px] border-0 bg-[#17152B] text-[13px] font-bold text-white hover:bg-[#2b2847] disabled:opacity-50"
            >
              {picking
                ? "Picking a time…"
                : loading
                  ? "Loading…"
                  : lesson.canReschedule
                    ? `Reschedule · ${lesson.rescheduleRemaining} left`
                    : "Reschedule"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={!lesson.canCancel || busy}
              className="h-[38px] rounded-[10px] border border-[#DFE1EC] bg-white text-[13px] font-bold text-[#17152B] hover:bg-[#F5F6FA] disabled:opacity-50"
            >
              {lesson.canCancel ? `Cancel · ${lesson.cancelRemaining} left` : "Cancel"}
            </button>
          </div>
          {(lesson.rescheduleReason || lesson.cancelReason) && (
            <p className="text-[12px] text-muted">
              {lesson.rescheduleReason === lesson.cancelReason
                ? lesson.rescheduleReason
                : [
                    lesson.rescheduleReason && `Reschedule: ${lesson.rescheduleReason.toLowerCase()}`,
                    lesson.cancelReason && `Cancel: ${lesson.cancelReason.toLowerCase()}`,
                  ]
                    .filter(Boolean)
                    .join(". ")}
            </p>
          )}
        </div>
      )}

      {(subjectHref || showOffice || recapHref) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {recapHref && (
            <Link
              href={recapHref}
              className="rounded-[6px] text-[13px] font-bold text-[#3A1AA8] hover:text-[#21106B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              Read the recap →
            </Link>
          )}
          {subjectHref && (
            <Link
              href={subjectHref}
              className="rounded-[6px] text-[13px] font-bold text-[#3A1AA8] hover:text-[#21106B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              Go to this week in {lesson.subjectName} →
            </Link>
          )}
          {showOffice && messageHref && (
            <Link
              href={messageHref}
              className="rounded-[6px] text-[13px] font-bold text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              Message the office
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
