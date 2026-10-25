import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  buttonVariants,
  Empty,
  GlassPanel,
  PageHeader,
  Pill,
  SubjectDot,
  type PillTone,
} from "@/components/admin/ui";
import { requireTutor } from "@/app/tutor/_data";
import {
  formatDateShort,
  formatTimeRange,
  formatWeekday,
  weekRangeLabel,
} from "@/lib/format";
import {
  checkinApprovalTimingError,
  addIsoDays,
  checkinPay,
  weekStartForIsoDate,
} from "@/lib/tutor-checkin-rules";
import {
  checkinEntryLabel,
  getTutorCheckinWeek,
} from "@/lib/tutor-checkins";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { cn } from "@/lib/utils";
import { TutorCheckinActions } from "./_components/checkin-actions";
import { getPendingCheckinWeeks } from "./_lib/queries";
import { checkinWeekLabel } from "@/lib/checkin-week";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ week?: string }>;

const GLASS_ICON = buttonVariants({ variant: "glass", size: "icon" });
const GLASS_MD = buttonVariants({ variant: "glass", size: "md" });

const STATUS: Record<"pending" | "approved" | "disputed", { pill: string; tone: PillTone }> = {
  pending: { pill: "Awaiting your approval", tone: "warn" },
  approved: { pill: "Approved", tone: "good" },
  disputed: { pill: "Correction requested", tone: "bad" },
};

const IN_PROGRESS = { pill: "Week in progress", tone: "info" as PillTone };

const TH = "px-3 py-3 text-[12px] font-extrabold text-muted";

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
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
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
  const thisWeek = weekStartForIsoDate(melbourneDate());
  const view = await getTutorCheckinWeek(tutor.id, week);
  const activeEntries = view.entries.filter((entry) => !entry.isRemoved);
  const correctedCount = activeEntries.filter((entry) => entry.isManualOverride).length;
  // The server refuses approval until every lesson has finished; say so up
  // front instead of offering a button that can only fail.
  const notFinished =
    view.status === "pending" && activeEntries.length > 0
      ? checkinApprovalTimingError(activeEntries)
      : null;
  const status = notFinished ? IN_PROGRESS : STATUS[view.status];

  return (
    <div className="flex max-w-[1040px] flex-col gap-5">
      <PageHeader
        title="Weekly check-in"
        // The page opens on the oldest week still waiting for approval, so
        // say which week is the current one rather than leave it to guess.
        sub={[checkinWeekLabel(week), weekRangeLabel(week), week === thisWeek ? "This week" : null]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={`/tutor/checkin?week=${addIsoDays(week, -7)}`}
              aria-label="Previous week"
              className={GLASS_ICON}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            </Link>
            <Link
              href={`/tutor/checkin?week=${thisWeek}`}
              aria-current={week === thisWeek ? "date" : undefined}
              className={GLASS_MD}
            >
              This week
            </Link>
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

      <GlassPanel
        title="Lessons this week"
        titleId="checkin-lessons-heading"
        action={
          view.entries.length > 0 ? <Pill tone={status.tone}>{status.pill}</Pill> : undefined
        }
      >
        {view.entries.length === 0 ? (
          <Empty>No lessons this week, so there are no hours to approve.</Empty>
        ) : (
          <div className="overflow-x-auto">
            {/* On a phone the date and notes sit under the lesson, so the
                hours and pay columns stay on screen without scrolling. */}
            <table className="w-full border-collapse text-[14px] sm:min-w-[640px]">
              <thead>
                <tr className="text-left">
                  <th scope="col" className={cn(TH, "pl-4 sm:pl-5")}>Lesson</th>
                  <th scope="col" className={cn(TH, "hidden sm:table-cell")}>When</th>
                  <th scope="col" className={cn(TH, "text-right")}>Hours</th>
                  <th scope="col" className={cn(TH, "text-right")}>Pay</th>
                  <th scope="col" className={cn(TH, "hidden pr-4 text-right sm:table-cell sm:pr-5")}>Note</th>
                </tr>
              </thead>
              <tbody>
                {view.entries.map((entry) => {
                  const label = checkinEntryLabel(entry);
                  const when = `${formatWeekday(entry.workDate, "short")} ${formatDateShort(entry.workDate)} · ${formatTimeRange(entry.startTime, entry.endTime)}`;
                  const notes = (entry.isManualOverride || entry.isRemoved) && (
                    <span className="inline-flex flex-wrap justify-end gap-1.5">
                      {entry.isManualOverride && <Pill tone="info">Corrected by admin</Pill>}
                      {entry.isRemoved && <Pill tone="bad">Removed from pay</Pill>}
                    </span>
                  );
                  return (
                    <tr
                      key={entry.id}
                      className={cn("border-t border-line", entry.isRemoved && "bg-surface-2 text-muted")}
                    >
                      <td className="py-3 pl-4 pr-3 sm:pl-5">
                        <span
                          className={cn(
                            "flex items-center gap-2 font-bold",
                            entry.isRemoved ? "text-muted line-through" : "text-ink",
                          )}
                        >
                          <SubjectDot subject={entry.subjectName} color={entry.subjectColor} className="h-2 w-2" />
                          {label}
                        </span>
                        <span className="mt-0.5 block pl-4 text-[12px] text-muted sm:hidden">{when}</span>
                        {entry.note && (
                          <span className="mt-0.5 block pl-4 text-[12px] text-muted">{entry.note}</span>
                        )}
                        {notes && <span className="mt-1.5 block pl-4 sm:hidden">{notes}</span>}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-muted sm:table-cell">{when}</td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums",
                          entry.isRemoved ? "text-muted line-through" : "text-ink",
                        )}
                      >
                        {hoursLabel(entry.minutes)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-ink">
                        {entry.isRemoved || Number(entry.hourlyRate) <= 0
                          ? "-"
                          : money(checkinPay(entry.minutes, entry.hourlyRate))}
                      </td>
                      <td className="hidden py-3 pl-3 pr-4 text-right sm:table-cell sm:pr-5">{notes}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-[#FAFBFD]">
                  <th scope="row" className="py-3 pl-4 pr-3 text-left font-extrabold text-ink sm:pl-5">
                    Hours worked this week
                  </th>
                  <td className="hidden sm:table-cell" />
                  <td className="px-3 py-3 text-right font-extrabold tabular-nums text-ink">
                    {hoursLabel(view.totalMinutes)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums text-ink">
                    {view.hasMissingRate ? "-" : money(view.totalPay)}
                  </td>
                  <td className="hidden sm:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="flex flex-col gap-3.5 border-t border-line p-4">
          <TutorCheckinActions
            weekStart={week}
            status={view.status}
            hasEntries={activeEntries.length > 0}
            hasMissingRate={view.hasMissingRate}
            correctedCount={correctedCount}
            notFinished={Boolean(notFinished)}
            initialMessage={view.disputeMessage}
          />
          {nextPending && (
            <Link
              href={`/tutor/checkin?week=${nextPending}`}
              className="inline-flex min-h-11 items-center gap-1 self-start rounded-[8px] text-[13px] font-bold text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {nextPending < week ? "Earlier" : "Next"} week to approve: {weekRangeLabel(nextPending)}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
