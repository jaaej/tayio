import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  buttonVariants,
  Empty,
  GlassPanel,
  MetricTile,
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

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ week?: string }>;

const GLASS_ICON = buttonVariants({ variant: "glass", size: "icon" });
const GLASS_MD = buttonVariants({ variant: "glass", size: "md" });

const STATUS: Record<
  "pending" | "approved" | "disputed",
  { tile: string; pill: string; tone: PillTone; tileTone: "warn" | "good" | "bad" }
> = {
  pending: { tile: "To approve", pill: "Awaiting your approval", tone: "warn", tileTone: "warn" },
  approved: { tile: "Approved", pill: "Approved", tone: "good", tileTone: "good" },
  disputed: { tile: "Reported", pill: "Correction requested", tone: "bad", tileTone: "bad" },
};

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
  const week = safeWeek(requestedWeek);
  const thisWeek = weekStartForIsoDate(melbourneDate());
  const view = await getTutorCheckinWeek(tutor.id, week);
  const activeEntries = view.entries.filter((entry) => !entry.isRemoved);
  const correctedCount = activeEntries.filter((entry) => entry.isManualOverride).length;
  const rates = new Set(activeEntries.map((entry) => Number(entry.hourlyRate)));
  const singleRate = rates.size === 1 ? [...rates][0] : null;
  const status = STATUS[view.status];

  return (
    <div className="flex max-w-[1040px] flex-col gap-5">
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

      <div className="glass grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-1.5 rounded-[22px] p-1.5">
        <MetricTile label="Week" value={weekRangeLabel(week)} />
        <MetricTile
          label="Worked hours"
          value={hoursLabel(view.totalMinutes)}
          sub={`${activeEntries.length} ${activeEntries.length === 1 ? "lesson" : "lessons"}`}
        />
        <MetricTile
          label="Estimated pay"
          value={view.hasMissingRate ? "Rate not set" : money(view.totalPay)}
          tone={view.hasMissingRate ? "warn" : "default"}
          sub={
            !view.hasMissingRate && singleRate !== null
              ? `at ${money(singleRate)} / hr`
              : undefined
          }
        />
        <MetricTile
          label="Status"
          value={activeEntries.length === 0 ? "No lessons" : status.tile}
          tone={activeEntries.length === 0 ? "default" : status.tileTone}
        />
      </div>

      <GlassPanel
        title="Lessons this week"
        titleId="checkin-lessons-heading"
        action={
          view.entries.length > 0 ? <Pill tone={status.tone}>{status.pill}</Pill> : undefined
        }
      >
        {view.entries.length === 0 ? (
          <Empty>No scheduled lessons this week.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[14px]">
              <thead>
                <tr className="text-left">
                  <th scope="col" className={cn(TH, "pl-4 sm:pl-5")}>Lesson</th>
                  <th scope="col" className={TH}>When</th>
                  <th scope="col" className={cn(TH, "text-right")}>Hours</th>
                  <th scope="col" className={cn(TH, "text-right")}>Pay</th>
                  <th scope="col" className={cn(TH, "pr-4 text-right sm:pr-5")}>Note</th>
                </tr>
              </thead>
              <tbody>
                {view.entries.map((entry) => {
                  const label = checkinEntryLabel(entry);
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
                          <SubjectDot subject={entry.subjectName} className="h-2 w-2" />
                          {label}
                        </span>
                        {entry.note && (
                          <span className="mt-0.5 block pl-4 text-[12px] text-muted">{entry.note}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted">
                        {formatWeekday(entry.workDate, "short")} {formatDateShort(entry.workDate)} · {formatTimeRange(entry.startTime, entry.endTime)}
                      </td>
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
                      <td className="py-3 pl-3 pr-4 text-right sm:pr-5">
                        <span className="inline-flex flex-wrap justify-end gap-1.5">
                          {entry.isManualOverride && <Pill tone="info">Corrected by admin</Pill>}
                          {entry.isRemoved && <Pill tone="bad">Removed from pay</Pill>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-[#FAFBFD]">
                  <th scope="row" colSpan={2} className="py-3 pl-4 pr-3 text-left font-extrabold text-ink sm:pl-5">
                    Total
                  </th>
                  <td className="px-3 py-3 text-right font-extrabold tabular-nums text-ink">
                    {hoursLabel(view.totalMinutes)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums text-ink">
                    {view.hasMissingRate ? "-" : money(view.totalPay)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </GlassPanel>

      <GlassPanel title="Confirm this week" titleId="checkin-confirm-heading" bodyClassName="p-4">
        <TutorCheckinActions
          weekStart={week}
          status={view.status}
          hasEntries={activeEntries.length > 0}
          hasMissingRate={view.hasMissingRate}
          correctedCount={correctedCount}
          initialMessage={view.disputeMessage}
        />
      </GlassPanel>
    </div>
  );
}
