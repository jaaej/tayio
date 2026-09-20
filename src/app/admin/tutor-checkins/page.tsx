import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardBody, CardHead, Empty, PageHeader, Pill } from "@/components/admin/ui";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { db } from "@/db/client";
import { classes, profiles, subjects } from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { formatDateLong, formatTime, weekRangeLabel } from "@/lib/format";
import {
  addIsoDays,
  checkinPay,
  weekStartForIsoDate,
} from "@/lib/tutor-checkin-rules";
import {
  checkinEntryLabel,
  getTutorCheckinMonthSummary,
  getTutorCheckinWeek,
} from "@/lib/tutor-checkins";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { CheckinEntryEditor } from "./_components/entry-editor";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  week?: string;
  month?: string;
  tutor?: string;
  class?: string;
}>;

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
  const views = await Promise.all(
    visibleTutors.map(async (tutor) => ({
      tutor,
      view: await getTutorCheckinWeek(tutor.id, week),
    })),
  );
  const filteredViews = selectedClass
    ? views.filter(({ view }) =>
        view.entries.some((entry) => entry.classId === selectedClass),
      )
    : views;
  const weeklyApprovedPay = filteredViews.reduce(
    (sum, row) => {
      if (row.view.status !== "approved") return sum;
      const entries = row.view.entries.filter(
        (entry) =>
          !entry.isRemoved &&
          (!selectedClass || entry.classId === selectedClass),
      );
      return (
        sum +
        entries.reduce(
          (entrySum, entry) =>
            entrySum + checkinPay(entry.minutes, entry.hourlyRate),
          0,
        )
      );
    },
    0,
  );
  const weeklyPending = filteredViews.filter(({ view }) => {
    if (view.status === "approved") return false;
    return view.entries.some(
      (entry) =>
        !entry.isRemoved &&
        (!selectedClass || entry.classId === selectedClass),
    );
  }).length;
  const monthSummary = await getTutorCheckinMonthSummary(month, {
    tutorId: selectedTutor || undefined,
    classId: selectedClass || undefined,
  });
  const monthlyApprovedPay = monthSummary.reduce(
    (sum, row) => sum + row.approvedPay,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Owner payroll"
        title="Tutor check-ins"
        sub="Review approved hours, resolve tutor questions, and keep a dated payroll record."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={hrefFor(addIsoDays(week, -7), month, selectedTutor, selectedClass)}
              aria-label="Previous week"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink hover:border-brand-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={hrefFor(weekStartForIsoDate(melbourneDate()), month, selectedTutor, selectedClass)}
              className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-[12px] font-bold text-ink hover:border-brand-400"
            >
              This week
            </Link>
            <Link
              href={hrefFor(addIsoDays(week, 7), month, selectedTutor, selectedClass)}
              aria-label="Next week"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink hover:border-brand-400"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <Card>
        <CardBody className="space-y-3">
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" method="get">
            <input type="hidden" name="week" value={week} />
            <input type="hidden" name="month" value={month} />
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Tutor</span>
              <select name="tutor" defaultValue={selectedTutor} className="h-10 w-full rounded-[9px] border border-line bg-surface px-3 text-[12px] text-ink">
                <option value="">All tutors</option>
                {tutors.map((tutor) => (
                  <option key={tutor.id} value={tutor.id}>
                    {tutor.firstName} {tutor.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Class</span>
              <select name="class" defaultValue={selectedClass} className="h-10 w-full rounded-[9px] border border-line bg-surface px-3 text-[12px] text-ink">
                <option value="">All classes</option>
                {classRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {classDisplayName(row.subjectName, row.className)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="self-end h-10 rounded-full bg-ink px-5 text-[12px] font-bold text-white">
              Apply filters
            </button>
          </form>
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Selected week" value={weekRangeLabel(week)} />
        <Metric label="Approved pay this week" value={money(weeklyApprovedPay)} />
        <Metric label="Awaiting approval" value={`${weeklyPending} tutor${weeklyPending === 1 ? "" : "s"}`} />
      </div>

      {filteredViews.length === 0 ? (
        <Card><Empty>No active tutors match these filters.</Empty></Card>
      ) : (
        <div className="space-y-4">
          {filteredViews.map(({ tutor, view }) => {
            const entries = selectedClass
              ? view.entries.filter((entry) => entry.classId === selectedClass)
              : view.entries;
            const active = entries.filter((entry) => !entry.isRemoved);
            const filteredMinutes = active.reduce((sum, entry) => sum + entry.minutes, 0);
            const filteredPay = active.reduce(
              (sum, entry) => sum + checkinPay(entry.minutes, entry.hourlyRate),
              0,
            );
            const filteredHasMissingRate = active.some(
              (entry) => Number(entry.hourlyRate) <= 0,
            );
            return (
              <Card
                key={view.id}
                accent={
                  active.length === 0
                    ? undefined
                    : view.status === "approved"
                    ? "good"
                    : view.status === "disputed"
                      ? "bad"
                      : "warn"
                }
              >
                <CardHead
                  title={`${tutor.firstName} ${tutor.lastName}`}
                  eyebrow={`${hoursLabel(filteredMinutes)} · ${money(filteredPay)}`}
                  action={
                    <Pill tone={active.length === 0 ? "default" : view.status === "approved" ? "good" : view.status === "disputed" ? "bad" : "warn"} dot={active.length > 0}>
                      {active.length === 0 ? "No work" : view.status === "approved" ? "Approved" : view.status === "disputed" ? "Issue reported" : "Pending"}
                    </Pill>
                  }
                />
                {view.disputeMessage && (
                  <div className="border-b border-bad/20 bg-bad-bg px-5 py-3 text-[12px] text-bad">
                    <strong>Tutor note:</strong> {view.disputeMessage}
                  </div>
                )}
                {entries.length === 0 ? (
                  <Empty>
                    {selectedClass ? "No rows for this class in the selected week." : "No scheduled lessons in this week."}
                  </Empty>
                ) : (
                  <ul className="divide-y divide-line">
                    {entries.map((entry) => (
                      <li key={entry.id} className={entry.isRemoved ? "bg-surface-2 opacity-70" : ""}>
                        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
                          <div className="min-w-0">
                            <div className={`text-[13px] font-extrabold text-ink ${entry.isRemoved ? "line-through" : ""}`}>
                              {checkinEntryLabel(entry)}
                            </div>
                            <div className="mt-1 text-[12px] text-muted">
                              {formatDateLong(entry.workDate)} · {formatTime(entry.startTime)}–{formatTime(entry.endTime)}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {entry.isManualOverride && <Pill tone="brand">Admin corrected</Pill>}
                              {entry.isRemoved && <Pill tone="bad">Removed</Pill>}
                              {entry.note && <span className="text-[11px] text-muted">{entry.note}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[13px] font-extrabold text-ink">{hoursLabel(entry.minutes)}</div>
                            <div className="mt-0.5 text-[11px] text-muted">
                              {money(checkinPay(entry.minutes, entry.hourlyRate))} · {money(Number(entry.hourlyRate))}/hr
                            </div>
                          </div>
                        </div>
                        <CheckinEntryEditor entry={entry} />
                      </li>
                    ))}
                  </ul>
                )}
                {filteredHasMissingRate && (
                  <div className="border-t border-warn/20 bg-warn-bg px-5 py-3 text-[11px] font-semibold text-warn">
                    An hourly rate is missing. Set it on{" "}
                    <Link
                      href={`/admin/users/${tutor.id}?tab=tutor`}
                      className="underline underline-offset-2"
                    >
                      {tutor.firstName}&apos;s user record
                    </Link>
                    , then review this pending week.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card accent="brand">
        <CardHead
          title="Monthly payroll history"
          eyebrow="Approved snapshots only count as owed"
          action={<Pill tone="brand">{money(monthlyApprovedPay)} approved</Pill>}
        />
        <CardBody>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="week" value={week} />
            {selectedTutor && <input type="hidden" name="tutor" value={selectedTutor} />}
            {selectedClass && <input type="hidden" name="class" value={selectedClass} />}
            <label className="space-y-1">
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Month</span>
              <input type="month" name="month" defaultValue={month} className="h-10 rounded-[9px] border border-line bg-surface px-3 text-[12px] text-ink" />
            </label>
            <button type="submit" className="h-10 rounded-full border border-line-strong bg-surface px-4 text-[12px] font-bold text-ink">View month</button>
          </form>
          {monthSummary.length === 0 ? (
            <p className="py-5 text-center text-[12px] text-muted">
              No generated check-in records for this month yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-line">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead className="bg-surface-2 text-[10px] uppercase tracking-[0.1em] text-muted">
                  <tr>
                    <th className="px-3 py-2.5">Tutor</th>
                    <th className="px-3 py-2.5">Approved hours</th>
                    <th className="px-3 py-2.5">Approved pay owed</th>
                    <th className="px-3 py-2.5">Pending hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {monthSummary.map((row) => (
                    <tr key={row.tutorId}>
                      <td className="px-3 py-3 font-bold text-ink">{row.tutorName}</td>
                      <td className="px-3 py-3 text-ink">{hoursLabel(row.approvedMinutes)} · {row.approvedWeeks} week{row.approvedWeeks === 1 ? "" : "s"}</td>
                      <td className="px-3 py-3 font-extrabold text-good">{money(row.approvedPay)}</td>
                      <td className="px-3 py-3 text-muted">{hoursLabel(row.pendingMinutes)} · {money(row.pendingPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</div>
        <div className="mt-1 text-[17px] font-extrabold text-ink">{value}</div>
      </CardBody>
    </Card>
  );
}
