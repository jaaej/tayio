import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GlassPanel, PageHeader, buttonVariants } from "@/components/admin/ui";
import { UrlLabelledSelect } from "@/components/admin/ui/labelled-select";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { db } from "@/db/client";
import { classes, profiles, subjects } from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { formatDateLong, formatDayDate, formatTimeRange, weekRangeLabel } from "@/lib/format";
import {
  addIsoDays,
  checkinPay,
  weekStartForIsoDate,
} from "@/lib/tutor-checkin-rules";
import {
  checkinEntryLabel,
  getTutorCheckinMonthSummary,
  getTutorCheckinWeeks,
} from "@/lib/tutor-checkins";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { checkinWeekLabel } from "@/lib/checkin-week";
import {
  buildMatrixRow,
  hoursLabel,
  rateLabel,
  weekDates,
  weekSummary,
} from "./_lib/matrix";
import {
  CheckinMatrix,
  type MatrixDay,
  type MatrixTutor,
} from "./_components/checkin-matrix";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  week?: string;
  month?: string;
  tutor?: string;
  class?: string;
}>;

const GLASS_ICON = buttonVariants({ variant: "glass", size: "icon" });
const GLASS_MD = buttonVariants({ variant: "glass", size: "md" });

// ISO dates are calendar dates; format them in UTC so the server's zone never
// shifts the day.
const dayShort = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});

function safeWeek(value: string | undefined) {
  try {
    return weekStartForIsoDate(value ?? melbourneDate());
  } catch {
    return weekStartForIsoDate(melbourneDate());
  }
}

function safeMonth(value: string | undefined, week: string) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ? value
    : week.slice(0, 7);
}

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(value);
}

function hrefFor(
  week: string,
  month: string,
  tutorId: string,
  classId: string,
) {
  const params = new URLSearchParams({ week, month });
  if (tutorId) params.set("tutor", tutorId);
  if (classId) params.set("class", classId);
  return `/admin/tutor-checkins?${params.toString()}`;
}

export default async function AdminTutorCheckinsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUnrestrictedAdmin();
  const params = await searchParams;
  const today = melbourneDate();
  const week = safeWeek(params.week);
  const month = safeMonth(params.month, week);
  const [tutors, classRows] = await Promise.all([
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(and(eq(profiles.role, "tutor"), eq(profiles.isActive, true)))
      .orderBy(asc(profiles.firstName), asc(profiles.lastName)),
    db
      .select({
        id: classes.id,
        className: classes.name,
        subjectName: subjects.name,
      })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .orderBy(asc(subjects.name), asc(classes.name)),
  ]);

  const selectedTutor = tutors.some((tutor) => tutor.id === params.tutor)
    ? params.tutor ?? ""
    : "";
  const selectedClass = classRows.some((row) => row.id === params.class)
    ? params.class ?? ""
    : "";
  const visibleTutors = selectedTutor
    ? tutors.filter((tutor) => tutor.id === selectedTutor)
    : tutors;
  // Sync the selected week's snapshots first so the monthly table includes a
  // newly generated current week on the very first page load.
  const checkinViews = await getTutorCheckinWeeks(
    visibleTutors.map((tutor) => tutor.id),
    week,
  );
  const views = visibleTutors.map((tutor, index) => ({
    tutor,
    view: checkinViews[index],
  }));
  const filteredViews = selectedClass
    ? views.filter(({ view }) =>
        view.entries.some((entry) => entry.classId === selectedClass),
      )
    : views;

  const matrixTutors: MatrixTutor[] = filteredViews.map(({ tutor, view }) => {
    const matrix = buildMatrixRow(view, week, selectedClass || undefined);
    const ids = new Set(matrix.entryIds);
    return {
      tutorId: tutor.id,
      name: `${tutor.firstName} ${tutor.lastName}`.trim(),
      rateLabel: rateLabel(matrix.rates, matrix.hasMissingRate),
      totalHours: hoursLabel(matrix.totalMinutes),
      totalPay: money(matrix.totalPay),
      matrix,
      cellHours: matrix.cells.map((cell) => hoursLabel(cell.minutes)),
      disputeMessage: view.status === "disputed" ? view.disputeMessage : null,
      entries: view.entries
        .filter((entry) => ids.has(entry.id))
        .map((entry) => ({
          id: entry.id,
          label: checkinEntryLabel(entry),
          when: `${formatDateLong(entry.workDate)} · ${formatTimeRange(entry.startTime, entry.endTime)}`,
          hours: hoursLabel(entry.minutes),
          payLine: `${money(checkinPay(entry.minutes, entry.hourlyRate))} · ${money(Number(entry.hourlyRate))}/hr`,
          note: entry.note,
          isRemoved: entry.isRemoved,
          isManualOverride: entry.isManualOverride,
          editor: {
            id: entry.id,
            subjectName: entry.subjectName,
            className: entry.className,
            workDate: entry.workDate,
            startTime: entry.startTime,
            endTime: entry.endTime,
            hourlyRate: entry.hourlyRate,
            note: entry.note,
            isRemoved: entry.isRemoved,
            updatedAt: entry.updatedAt.toISOString(),
          },
        })),
    };
  });
  const summary = weekSummary(matrixTutors.map((row) => row.matrix));

  const days: MatrixDay[] = weekDates(week).map((date) => {
    const instant = new Date(`${date}T00:00:00Z`);
    return {
      date,
      label: dayShort.format(instant),
      longLabel: formatDayDate(date),
      isToday: date === today,
    };
  });

  const monthSummary = await getTutorCheckinMonthSummary(month, {
    tutorId: selectedTutor || undefined,
    classId: selectedClass || undefined,
  });
  const monthlyApprovedPay = monthSummary.reduce(
    (sum, row) => sum + row.approvedPay,
    0,
  );

  const weekLabel = weekRangeLabel(week);
  const headerSub = [
    checkinWeekLabel(week),
    weekLabel,
    `${money(summary.approvedPay)} approved`,
    summary.awaiting > 0 ? `${summary.awaiting} awaiting approval` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tutor check-ins"
        sub={headerSub}
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={hrefFor(addIsoDays(week, -7), month, selectedTutor, selectedClass)}
              aria-label="Previous week"
              className={GLASS_ICON}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            </Link>
            <Link
              href={hrefFor(weekStartForIsoDate(today), month, selectedTutor, selectedClass)}
              aria-current={week === weekStartForIsoDate(today) ? "date" : undefined}
              className={GLASS_MD}
            >
              This week
            </Link>
            <Link
              href={hrefFor(addIsoDays(week, 7), month, selectedTutor, selectedClass)}
              aria-label="Next week"
              className={GLASS_ICON}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
        }
      />

      <CheckinMatrix
        tutors={matrixTutors}
        days={days}
        weekLabel={weekLabel}
        filters={
          <>
            <UrlLabelledSelect
              label="Tutor"
              param="tutor"
              options={[
                { value: "", label: "All" },
                ...tutors.map((tutor) => ({
                  value: tutor.id,
                  label: `${tutor.firstName} ${tutor.lastName}`.trim(),
                })),
              ]}
            />
            <UrlLabelledSelect
              label="Class"
              param="class"
              options={[
                { value: "", label: "All" },
                ...classRows.map((row) => ({
                  value: row.id,
                  label: classDisplayName(row.subjectName, row.className),
                })),
              ]}
            />
          </>
        }
      />

      <GlassPanel
        title="Monthly payroll history"
        titleId="checkin-month-h"
        meta={`${money(monthlyApprovedPay)} approved`}
        action={
          <form method="get" className="flex flex-wrap items-center gap-1.5">
            <input type="hidden" name="week" value={week} />
            {selectedTutor && <input type="hidden" name="tutor" value={selectedTutor} />}
            {selectedClass && <input type="hidden" name="class" value={selectedClass} />}
            <label className="sr-only" htmlFor="checkin-month">
              Month
            </label>
            <input
              id="checkin-month"
              type="month"
              name="month"
              defaultValue={month}
              className="h-9 rounded-[10px] border border-white/95 bg-white/65 px-3 text-[13px] font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            />
            <button type="submit" className={GLASS_MD}>
              View month
            </button>
          </form>
        }
      >
        {monthSummary.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted">
            No generated check-in records for this month yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="text-[12px] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-extrabold">Tutor</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Approved hours</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Approved pay owed</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Pending hours</th>
                </tr>
              </thead>
              <tbody>
                {monthSummary.map((row) => (
                  <tr key={row.tutorId} className="border-t border-line">
                    <th scope="row" className="px-4 py-3 text-left font-extrabold text-ink">
                      {row.tutorName}
                    </th>
                    <td className="px-4 py-3 tabular-nums text-ink">
                      {hoursLabel(row.approvedMinutes)} · {row.approvedWeeks} week{row.approvedWeeks === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3 font-extrabold tabular-nums text-good">
                      {money(row.approvedPay)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">
                      {hoursLabel(row.pendingMinutes)} · {money(row.pendingPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
