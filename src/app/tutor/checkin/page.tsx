import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants, Empty, PageHeader, Pill, type PillTone } from "@/components/admin/ui";
import { WeekTimeGrid, type TimeGridEvent } from "@/components/data/week-time-grid";
import { requireTutor } from "@/app/tutor/_data";
import { weekRangeLabel } from "@/lib/format";
import {
  checkinApprovalTimingError,
  addIsoDays,
  weekStartForIsoDate,
} from "@/lib/tutor-checkin-rules";
import { checkinEntryLabel, getTutorCheckinWeek } from "@/lib/tutor-checkins";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { TutorCheckinActions } from "./_components/checkin-actions";
import { correctionLines } from "./_lib/corrections";
import { getPendingCheckinWeeks, getScheduledLessons } from "./_lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ week?: string }>;

const GLASS_ICON = buttonVariants({ variant: "glass", size: "icon" });

const STATUS: Record<"pending" | "approved" | "disputed", { pill: string; tone: PillTone }> = {
  pending: { pill: "Needs your approval", tone: "warn" },
  approved: { pill: "Approved", tone: "good" },
  disputed: { pill: "Correction requested", tone: "bad" },
};

const IN_PROGRESS = { pill: "Week in progress", tone: "info" as PillTone };

/** The grid is short enough to see the whole week without scrolling. */
const HOUR_PX = 48;

function safeWeek(value: string | undefined) {
  try {
    return weekStartForIsoDate(value ?? melbourneDate());
  } catch {
    return weekStartForIsoDate(melbourneDate());
  }
}

function hoursLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function money(value: number, cents = true) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function TutorCheckinPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tutor = await requireTutor();
  const { week: requestedWeek } = await searchParams;
  const pending = await getPendingCheckinWeeks(tutor.id);
  // Open on the oldest week still to confirm, with the week in the URL, so
  // approving it stays on it instead of jumping to the next one.
  if (!requestedWeek && pending[0]) redirect(`/tutor/checkin?week=${pending[0]}`);
  const week = safeWeek(requestedWeek);
  const nextPending = pending.find((w) => w !== week) ?? null;
  const today = melbourneDate();
  const view = await getTutorCheckinWeek(tutor.id, week);
  const activeEntries = view.entries.filter((entry) => !entry.isRemoved);
  const scheduled = await getScheduledLessons(
    view.entries.flatMap((e) => (e.isManualOverride && e.lessonId ? [e.lessonId] : [])),
  );
  const corrections = correctionLines(view.entries, scheduled);
  // The server refuses approval until every lesson has finished; say so up
  // front instead of offering a button that can only fail.
  const notFinished =
    view.status === "pending" && activeEntries.length > 0
      ? checkinApprovalTimingError(activeEntries)
      : null;
  const status = notFinished ? IN_PROGRESS : STATUS[view.status];

  const minutesByDay = new Map<string, number>();
  for (const e of activeEntries) {
    minutesByDay.set(e.workDate, (minutesByDay.get(e.workDate) ?? 0) + e.minutes);
  }
  const dayCaptions = Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => {
      const iso = addIsoDays(week, i);
      const minutes = minutesByDay.get(iso) ?? 0;
      return [iso, minutes > 0 ? hoursLabel(minutes) : "No lessons"];
    }),
  );
  const events: TimeGridEvent[] = activeEntries.map((e) => ({
    id: e.id,
    date: e.workDate,
    startTime: e.startTime,
    endTime: e.endTime,
    label: e.subjectName,
    title: checkinEntryLabel(e),
    subject: e.subjectName,
    subjectColor: e.subjectColor,
    badge: hoursLabel(e.minutes),
    flag: e.isManualOverride ? "Corrected" : undefined,
  }));
  const rates = new Set(activeEntries.map((e) => Number(e.hourlyRate)));
  const rate = rates.size === 1 ? [...rates][0] : 0;
  const summary = [
    hoursLabel(view.totalMinutes),
    `${activeEntries.length} ${activeEntries.length === 1 ? "lesson" : "lessons"}`,
    rate > 0 && `${money(rate, !Number.isInteger(rate))} an hour`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Weekly check-in"
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={`/tutor/checkin?week=${addIsoDays(week, -7)}`}
              aria-label="Previous week"
              className={GLASS_ICON}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            </Link>
            <span className="min-w-[120px] px-2 text-center text-[15px] font-extrabold tabular-nums text-ink">
              {weekRangeLabel(week)}
            </span>
            <Link
              href={`/tutor/checkin?week=${addIsoDays(week, 7)}`}
              aria-label="Next week"
              className={GLASS_ICON}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
        }
      />

      {nextPending && (
        <Link
          href={`/tutor/checkin?week=${nextPending}`}
          className="glass flex min-h-12 items-center gap-2.5 rounded-[18px] px-4 py-2.5 text-[14px] font-bold text-warn transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[#E8932C]" />
          <span className="min-w-0 flex-1">{weekRangeLabel(nextPending)} also needs your check-in</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            Open
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </Link>
      )}

      <section aria-label="Hours this week" className="glass rounded-[24px] p-1.5">
        <div className="panel overflow-hidden">
          {view.entries.length === 0 ? (
            <Empty>No lessons this week, so there are no hours to approve.</Empty>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5">
                <div className="flex flex-col gap-1">
                  <p
                    className="text-[28px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-ink"
                  >
                    {view.hasMissingRate ? "Rate not set" : money(view.totalPay)}
                  </p>
                  <p className="text-[13px] font-semibold text-ink-soft">{summary}</p>
                </div>
                <Pill tone={status.tone}>{status.pill}</Pill>
              </div>
              <div className="border-t border-line">
                <WeekTimeGrid
                  events={events}
                  weekStart={week}
                  todayIso={today}
                  detailed
                  noun="lesson"
                  hourPx={HOUR_PX}
                  dayCaptions={dayCaptions}
                  fullDayToggle={false}
                />
              </div>
            </>
          )}
          <TutorCheckinActions
            weekStart={week}
            status={view.status}
            hasEntries={activeEntries.length > 0}
            hasMissingRate={view.hasMissingRate}
            notFinished={Boolean(notFinished)}
            corrections={corrections}
            initialMessage={view.disputeMessage}
          />
        </div>
      </section>
    </div>
  );
}
