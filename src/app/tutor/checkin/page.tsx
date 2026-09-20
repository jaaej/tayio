import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock3, Wallet } from "lucide-react";
import { Card, CardBody, CardHead } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { requireTutor } from "@/app/tutor/_data";
import { formatDateLong, formatTime, weekRangeLabel } from "@/lib/format";
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
import { TutorCheckinActions } from "./_components/checkin-actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ week?: string }>;

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
  const view = await getTutorCheckinWeek(tutor.id, week);
  const activeEntries = view.entries.filter((entry) => !entry.isRemoved);
  const previous = addIsoDays(week, -7);
  const next = addIsoDays(week, 7);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Payroll"
        title="Weekly check-in"
        sub="Confirm the lessons you worked. Report anything incorrect before approving."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/tutor/checkin?week=${previous}`}
              aria-label="Previous week"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink hover:border-brand-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={`/tutor/checkin?week=${weekStartForIsoDate(melbourneDate())}`}
              className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-[12px] font-bold text-ink hover:border-brand-400"
            >
              This week
            </Link>
            <Link
              href={`/tutor/checkin?week=${next}`}
              aria-label="Next week"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink hover:border-brand-400"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Week" value={weekRangeLabel(week)} />
        <Summary label="Worked hours" value={hoursLabel(view.totalMinutes)} icon="time" />
        <Summary
          label="Estimated pay"
          value={view.hasMissingRate ? "Rate not set" : money(view.totalPay)}
          icon="pay"
        />
      </div>

      <Card accent="var(--brand-500)">
        <CardHead
          title="Scheduled lessons"
          action={
            <span className="capitalize">
              {view.status === "approved"
                ? "Approved"
                : view.status === "disputed"
                  ? "Correction requested"
                  : "Awaiting approval"}
            </span>
          }
        />
        {view.entries.length === 0 ? (
          <CardBody className="py-10 text-center text-[13px] text-muted">
            No scheduled lessons were found for this week.
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {view.entries.map((entry) => (
              <li
                key={entry.id}
                className={`flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 ${entry.isRemoved ? "bg-surface-2 opacity-60" : ""}`}
              >
                <div className="min-w-0">
                  <div className={`text-[13px] font-extrabold text-ink ${entry.isRemoved ? "line-through" : ""}`}>
                    {checkinEntryLabel(entry)}
                  </div>
                  <div className="mt-1 text-[12px] text-muted">
                    {formatDateLong(entry.workDate)} · {formatTime(entry.startTime)}–{formatTime(entry.endTime)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {entry.isManualOverride && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                        Corrected by admin
                      </span>
                    )}
                    {entry.isRemoved && (
                      <span className="rounded-full bg-bad-bg px-2 py-0.5 text-[10px] font-bold text-bad">
                        Removed from pay
                      </span>
                    )}
                    {entry.note && (
                      <span className="text-[11px] text-muted">{entry.note}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-extrabold text-ink">
                    {hoursLabel(entry.minutes)}
                  </div>
                  {!entry.isRemoved && Number(entry.hourlyRate) > 0 && (
                    <div className="mt-0.5 text-[11px] text-muted">
                      {money(checkinPay(entry.minutes, entry.hourlyRate))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {view.hasMissingRate && activeEntries.length > 0 && (
        <p className="rounded-[12px] border border-warn/25 bg-warn-bg px-4 py-3 text-[12px] text-warn">
          Admin must set your hourly rate before the correct pay total can be
          calculated or this week can be approved.
        </p>
      )}

      <Card>
        <CardHead title="Confirm this week" />
        <CardBody>
          <TutorCheckinActions
            weekStart={week}
            status={view.status}
            hasEntries={activeEntries.length > 0}
            hasMissingRate={view.hasMissingRate}
            initialMessage={view.disputeMessage}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function Summary({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: "time" | "pay";
}) {
  return (
    <Card flat>
      <CardBody className="flex items-center gap-3">
        {icon && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-700">
            {icon === "time" ? (
              <Clock3 className="h-4 w-4" aria-hidden />
            ) : (
              <Wallet className="h-4 w-4" aria-hidden />
            )}
          </div>
        )}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            {label}
          </div>
          <div className="mt-0.5 text-[14px] font-extrabold text-ink">{value}</div>
        </div>
      </CardBody>
    </Card>
  );
}
