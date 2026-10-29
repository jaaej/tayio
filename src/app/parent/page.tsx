import Link from "next/link";
import { Megaphone, Receipt } from "lucide-react";
import {
  Empty,
  GlassPanel,
  MetricTile,
  PageHeader,
  Pill,
  initialsOf,
} from "@/components/admin/ui";
import { RecapPreviewList } from "@/components/lessons/lesson-recap";
import { NextLessonCard } from "@/components/parent/next-lesson-card";
import { buildTimetableChips } from "@/app/_lib/timetable-chips";
import { nextAttendingLesson } from "@/app/student/_components/timetable-helpers";
import { relativeDay } from "@/app/student/_lib/dashboard-rules";
import { accountFirstName } from "@/lib/account-name";
import { requireRole } from "@/lib/auth";
import { attendanceRateTone } from "@/lib/attendance-rules";
import { formatMoney, melbourneDayKey, relativeTime } from "@/lib/format";
import { formatInvoiceDay } from "@/lib/invoice-dates";
import { invoiceDisplayStatus } from "@/lib/invoice-rules";
import { getFamilyRecaps } from "@/lib/lesson-recap";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/lib/status";
import { subjectTone } from "@/lib/subject-tone";
import {
  getAdminContact,
  getChildMastery,
  getChildTutors,
  getDashboardData,
  getHomework,
  getInvoicesForParent,
  getOutstandingBalanceForParent,
  getParentAnnouncements,
  resolveSelectedChild,
} from "./_data";
import { EmptyChildrenNotice } from "./_components/empty-children";
import { homeworkNeedingAttention } from "./_lib/overview-homework";

type SearchParams = Promise<{ child?: string }>;

/** How far ahead the Overview looks for the next lesson. */
const NEXT_LESSON_LOOKAHEAD_DAYS = 56;

const LINK =
  "rounded-[6px] px-1.5 text-[13px] font-bold text-[#3A1AA8] hover:text-[#21106B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

/**
 * The parent's summary of one child: how they are doing (attendance,
 * homework, mastery) and the family balance, the next lesson, homework that
 * is overdue or due this week, the tutor's latest recaps, then payments,
 * announcements and who to contact. Each part opens the page that does the
 * work.
 */
export default async function ParentOverview({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { selected } = await resolveSelectedChild(user.id, requested);

  const parentName = accountFirstName(user, "there");

  if (!selected) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={`Hello, ${parentName}`} />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const now = new Date();
  const today = melbourneDayKey(now);
  const [
    data,
    recaps,
    mastery,
    homeworkRows,
    invoices,
    outstanding,
    notices,
    tutors,
    office,
    lessonChips,
  ] = await Promise.all([
    getDashboardData(selected.id),
    getFamilyRecaps(selected.id, { limit: 4 }),
    getChildMastery(selected.id),
    getHomework(selected.id),
    getInvoicesForParent(user.id),
    getOutstandingBalanceForParent(user.id),
    getParentAnnouncements(user.id, 4),
    getChildTutors(selected.id),
    getAdminContact(),
    // The next lesson comes from the Timetable's own lessons.
    buildTimetableChips(
      selected.id,
      new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + NEXT_LESSON_LOOKAHEAD_DAYS),
    ),
  ]);

  const childQs = `?child=${selected.id}`;
  const nextLesson = nextAttendingLesson(lessonChips, now);
  const homework = homeworkNeedingAttention(homeworkRows, (h) => melbourneDayKey(h.dueDate), today);
  const markedSubjects = mastery.subjects.filter((s) => s.percent !== null).length;
  const recentInvoices = invoices.slice(0, 4);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={`Hello, ${parentName}`} />

      <section
        aria-label={`${selected.firstName} at a glance`}
        className="glass grid grid-cols-2 gap-1.5 rounded-[24px] p-1.5 lg:grid-cols-4"
      >
        <MetricTile
          label="Attendance"
          value={data.attendanceRate === null ? "-" : `${data.attendanceRate}%`}
          sub={data.absenceCount === 1 ? "1 absence" : `${data.absenceCount} absences`}
          tone={data.attendanceRate === null ? "default" : attendanceRateTone(data.attendanceRate)}
          href={`/parent/timetable${childQs}#attendance`}
        />
        <MetricTile
          label="Homework handed in"
          value={data.homeworkTotal > 0 ? `${data.homeworkCompleted}/${data.homeworkTotal}` : "-"}
          href={`/parent/homework${childQs}`}
        />
        <MetricTile
          label="Mastery"
          value={mastery.overall === null ? "-" : `${mastery.overall}%`}
          sub={
            mastery.overall === null
              ? "No marks yet"
              : `${markedSubjects} subject${markedSubjects === 1 ? "" : "s"}`
          }
          href={`/parent/progress${childQs}`}
        />
        <MetricTile
          label="Outstanding"
          value={formatMoney(outstanding)}
          sub={outstanding > 0 ? "Payment due" : "All paid up"}
          tone={outstanding > 0 ? "bad" : "good"}
          href="/parent/payments"
        />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <NextLessonCard
            lesson={nextLesson}
            timetableHref={`/parent/timetable${childQs}`}
            cantMakeItHref={
              nextLesson
                ? `/parent/timetable${childQs}&month=${nextLesson.date.slice(0, 7)}&lesson=${nextLesson.id}`
                : null
            }
          />

          <GlassPanel
            title="Homework"
            titleId="overview-homework"
            action={
              <Link href={`/parent/homework${childQs}`} className={LINK}>
                All homework
              </Link>
            }
          >
            {homework.items.length === 0 ? (
              <Empty>Nothing overdue or due this week.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {homework.items.map(({ item, dueDay, overdue }) => (
                  <li key={item.homeworkId}>
                    <Link
                      href={`/parent/homework/${item.homeworkId}${childQs}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: item.subjectName
                            ? subjectTone(item.subjectName, item.subjectColor).dot
                            : "var(--muted-2)",
                        }}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[14px] font-bold text-ink">{item.title}</span>
                        <span className="truncate text-[12px] text-muted">
                          {item.subjectName ?? item.className ?? "Independent task"}
                        </span>
                      </span>
                      <Pill tone={overdue ? "bad" : "warn"}>
                        {overdue ? "Overdue" : `Due ${relativeDay(dueDay, today)}`}
                      </Pill>
                    </Link>
                  </li>
                ))}
                {homework.moreOverdue > 0 && (
                  <li>
                    <Link
                      href={`/parent/homework${childQs}`}
                      className="flex h-11 items-center justify-center bg-[#FAFAFD] text-[13px] font-bold text-ink transition-colors hover:bg-[#F3F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                    >
                      {homework.moreOverdue} more overdue
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </GlassPanel>

          <GlassPanel
            title="From the tutor"
            titleId="overview-recaps"
            action={
              <Link href={`/parent/feedback${childQs}`} className={LINK}>
                All feedback
              </Link>
            }
          >
            {recaps.length === 0 ? (
              <Empty>
                No tutor feedback yet. When a tutor leaves a comment after one of{" "}
                {selected.firstName}&apos;s lessons, it appears here.
              </Empty>
            ) : (
              <RecapPreviewList
                items={recaps.map((recap) => ({
                  recap,
                  href: `/parent/feedback/${recap.lessonId}${childQs}`,
                }))}
              />
            )}
          </GlassPanel>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <GlassPanel
            title="Payments"
            titleId="overview-payments"
            action={
              <Link href="/parent/payments" className={LINK}>
                View all
              </Link>
            }
          >
            {recentInvoices.length === 0 ? (
              <Empty>No invoices issued yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {recentInvoices.map((r) => {
                  const status = invoiceDisplayStatus(r, today);
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <Receipt className="h-[17px] w-[17px] shrink-0 text-muted" aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-bold text-ink">
                          {r.description ?? "Tuition invoice"}
                        </span>
                        <span className="text-[12px] text-muted">
                          Due {formatInvoiceDay(r.dueDate, now, { weekday: true })}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-ink">
                        {formatMoney(Number(r.amount), r.currency)}
                      </span>
                      <Pill tone={INVOICE_STATUS_TONE[status] ?? "default"}>
                        {INVOICE_STATUS_LABEL[status] ?? status}
                      </Pill>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassPanel>

          <GlassPanel
            title="Announcements"
            titleId="overview-announcements"
            action={
              <Link href="/parent/notifications?filter=announcements" className={LINK}>
                See all
              </Link>
            }
          >
            {notices.length === 0 ? (
              <Empty>No announcements right now.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {notices.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/parent/notifications?announcement=${n.id}`}
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                    >
                      <Megaphone className="mt-0.5 h-[17px] w-[17px] shrink-0 text-brand-600" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13px] font-bold text-ink">{n.title}</span>
                          <span className="shrink-0 text-[11px] text-muted">
                            {relativeTime(new Date(n.publishedAt))}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-soft line-clamp-2">
                          {n.body}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>

          <GlassPanel title="Contact" titleId="overview-contact">
            {tutors.length === 0 && !office ? (
              <Empty>No contacts on file yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {tutors.map((t) => (
                  <ContactRow
                    key={t.id}
                    name={`${t.firstName} ${t.lastName}`.trim()}
                    meta={t.subjects.join(" · ")}
                    userId={t.id}
                  />
                ))}
                {office && (
                  <ContactRow
                    name={`${office.firstName} ${office.lastName}`.trim()}
                    meta="Office"
                    userId={office.id}
                  />
                )}
              </ul>
            )}
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}

function ContactRow({ name, meta, userId }: { name: string; meta?: string; userId: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-[12px] font-extrabold text-ink-soft"
      >
        {initialsOf(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-bold text-ink">{name}</span>
        {meta && <span className="truncate text-[12px] text-muted">{meta}</span>}
      </span>
      <Link
        href={`/parent/messages/with/${userId}`}
        className="inline-flex h-9 shrink-0 items-center rounded-[10px] border border-[#DFE1EC] bg-white px-3 text-[12px] font-bold text-ink transition-colors hover:bg-[#F5F6FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        Message
      </Link>
    </li>
  );
}
