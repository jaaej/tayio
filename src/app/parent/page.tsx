import Link from "next/link";
import {
  Receipt,
  Megaphone,
  ClipboardCheck,
  ClipboardList,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { Card, StatTile, Hero, Empty } from "@/components/parent/ui";
import { SubjectPill } from "@/components/data/subject-pill";
import { requireRole } from "@/lib/auth";
import {
  formatMoney,
  melbourneDayKey,
  relativeTime,
} from "@/lib/format";
import { formatInvoiceDay } from "@/lib/invoice-dates";
import { formatHomeworkDate } from "@/app/student/homework/_lib/homework-list";
import { homeworkStatusLabel } from "@/components/homework/homework-detail";
import { isHomeworkOverdue } from "@/lib/homework-rules";
import { invoiceDisplayStatus } from "@/lib/invoice-rules";
import {
  HOMEWORK_STATUS_STYLE,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_STYLE,
} from "@/lib/status";
import {
  getAdminContact,
  getChildTutors,
  getDashboardData,
  getHomework,
  getInvoicesForParent,
  getOutstandingBalanceForParent,
  getParentAnnouncements,
  getChildMastery,
  resolveSelectedChild,
} from "./_data";
import { ChildSwitcher, EmptyChildrenNotice } from "./_components/child-switcher";
import { SectionHeader } from "./_components/section-header";
import { StatusPill } from "./_components/status-pill";
import { Table, Th, Td, Tr } from "./_components/table";
import { RecapPreviewList } from "@/components/lessons/lesson-recap";
import { getFamilyRecaps } from "@/lib/lesson-recap";

type SearchParams = Promise<{ child?: string }>;

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, requested);

  const parentName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "there";

  if (!selected) {
    return (
      <div className="space-y-6">
        <Hero
          eyebrow="Parent portal"
          title={`Hello, ${parentName}`}
        />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const [
    data,
    recaps,
    mastery,
    homeworkRows,
    invoices,
    outstanding,
    notices,
    tutors,
    admin,
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
  ]);

  const overallMastery = mastery.overall;
  const markedSubjects = mastery.subjects.filter((s) => s.percent !== null).length;


  const recentHomework = homeworkRows.slice(0, 5);
  const recentInvoices = invoices.slice(0, 4);
  const now = new Date();
  const today = melbourneDayKey(now);

  const childQs = `?child=${selected.id}`;

  return (
    <div className="space-y-6">
      <Hero
        eyebrow="Parent portal"
        title={`Hello, ${parentName}`}
        right={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Link
              href={`/parent/classes${childQs}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-bold rounded-full bg-white/[0.14] border border-white/30 text-white hover:bg-white/[0.22] transition-colors"
            >
              View timetable
            </Link>
            <Link
              href="/parent/payments"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-bold rounded-full bg-white text-brand-700 hover:bg-brand-50 transition-colors"
            >
              Payments
            </Link>
          </div>
        }
      />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            students={children}
            selectedId={selected.id}
            basePath="/parent"
          />
        </div>
      )}

      {/* KPI row */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Attendance"
          value={data.attendanceRate !== null ? `${data.attendanceRate}%` : "-"}
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="mint"
          accent
          delta="All logged lessons"
          deltaTone={
            data.attendanceRate !== null && data.attendanceRate >= 90
              ? "up"
              : data.attendanceRate !== null && data.attendanceRate < 75
                ? "down"
                : "flat"
          }
          href={`/parent/classes${childQs}#attendance`}
        />
        <StatTile
          label="Homework"
          value={
            data.homeworkTotal > 0
              ? `${data.homeworkCompleted}/${data.homeworkTotal}`
              : "-"
          }
          icon={<ClipboardList className="h-5 w-5" />}
          tone="sky"
          accent
          delta="Handed in"
          deltaTone={
            data.homeworkTotal > 0 &&
            data.homeworkCompleted / data.homeworkTotal >= 0.9
              ? "up"
              : "flat"
          }
          href={`/parent/homework${childQs}`}
        />
        <StatTile
          label="Overall mastery"
          value={overallMastery !== null ? `${overallMastery}%` : "-"}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="grape"
          accent
          delta={
            overallMastery === null
              ? "No marks yet"
              : `${markedSubjects} subject${markedSubjects === 1 ? "" : "s"}`
          }
          href={`/parent/progress${childQs}`}
        />
        <StatTile
          label="Outstanding"
          value={formatMoney(outstanding)}
          icon={<CreditCard className="h-5 w-5" />}
          tone={outstanding > 0 ? "warn" : "good"}
          accent
          delta={outstanding > 0 ? "Payment due" : "All paid up"}
          deltaTone={outstanding > 0 ? "down" : "up"}
          href="/parent/payments"
        />
      </section>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5 lg:gap-6">
        {/* LEFT */}
        <div className="space-y-5 min-w-0 rise" style={{ animationDelay: "80ms" }}>
          <Card>
            <SectionHeader
              title="From the tutor"
              link={{ href: `/parent/feedback${childQs}`, label: "All feedback" }}
            />
            {recaps.length === 0 ? (
              <Empty>
                No tutor notes yet. After {selected.firstName}&apos;s next lesson the
                tutor&apos;s note will appear here.
              </Empty>
            ) : (
              <RecapPreviewList
                items={recaps.map((recap) => ({
                  recap,
                  href: `/parent/feedback/${recap.lessonId}${childQs}`,
                }))}
              />
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Homework"
              link={{ href: "/parent/homework", label: "All homework" }}
            />
            {recentHomework.length === 0 ? (
              <Empty>No homework assigned to {selected.firstName} yet.</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Task</Th>
                    <Th>Subject</Th>
                    <Th>Due</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentHomework.map((h) => (
                    <Tr key={h.homeworkId}>
                      <Td>
                        <Link
                          href={`/parent/homework/${h.homeworkId}${childQs}`}
                          className="font-bold text-ink hover:text-brand-700 hover:underline"
                        >
                          {h.title}
                        </Link>
                      </Td>
                      <Td>
                        <SubjectPill
                          name={h.subjectName ?? h.className ?? "Other"}
                          color={h.subjectName ? h.subjectColor : null}
                        />
                      </Td>
                      <Td className="text-muted whitespace-nowrap">
                        {formatHomeworkDate(h.dueDate)}
                      </Td>
                      <Td>
                        <StatusPill
                          label={
                            isHomeworkOverdue(h.status, melbourneDayKey(h.dueDate), today)
                              ? "Overdue"
                              : homeworkStatusLabel(h.status)
                          }
                          className={
                            isHomeworkOverdue(h.status, melbourneDayKey(h.dueDate), today)
                              ? "bg-rose-100 text-rose-800"
                              : HOMEWORK_STATUS_STYLE[h.status]
                          }
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <aside
          className="space-y-5 min-w-0 rise"
          style={{ animationDelay: "120ms" }}
        >
          <Card>
            <SectionHeader
              title="Payments"
              link={{ href: "/parent/payments", label: "View all" }}
            />
            {recentInvoices.length === 0 ? (
              <Empty>No invoices issued yet.</Empty>
            ) : (
              <div className="divide-y divide-line/70">
                {recentInvoices.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                    <Receipt
                      className="h-[18px] w-[18px] text-muted shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink truncate">
                        {r.description ?? "Tuition invoice"}
                      </div>
                      <div className="text-xs text-muted">
                        Due {formatInvoiceDay(r.dueDate, now, { weekday: true })}
                      </div>
                    </div>
                    <div className="text-sm font-extrabold text-ink tabular-nums shrink-0">
                      {formatMoney(Number(r.amount), r.currency)}
                    </div>
                    <StatusPill
                      label={INVOICE_STATUS_LABEL[invoiceDisplayStatus(r, today)] ?? r.status}
                      className={INVOICE_STATUS_STYLE[invoiceDisplayStatus(r, today)]}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Announcements"
              link={{ href: "/parent/notifications?filter=announcements", label: "See all" }}
            />
            {notices.length === 0 ? (
              <Empty>No announcements right now.</Empty>
            ) : (
              <ul className="divide-y divide-line/70">
                {notices.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/parent/notifications?announcement=${n.id}`}
                      className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                    >
                      <Megaphone
                        className="h-[18px] w-[18px] text-brand-500 shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-bold text-ink truncate">
                            {n.title}
                          </span>
                          <span className="text-[11px] text-muted shrink-0">
                            {relativeTime(new Date(n.publishedAt))}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm text-ink-soft leading-relaxed line-clamp-2">
                          {n.body}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeader title="Contact" />
            <div className="divide-y divide-line/70">
              {tutors.length === 0 && !admin ? (
                <Empty>No contacts on file yet.</Empty>
              ) : (
                <>
                  {tutors.map((t) => (
                    <ContactRow
                      key={t.id}
                      name={`${t.firstName} ${t.lastName}`.trim()}
                      meta={t.subjects.join(" · ")}
                      userId={t.id}
                    />
                  ))}
                  {admin && (
                    <ContactRow
                      name={`${admin.firstName} ${admin.lastName}`.trim()}
                      meta="Admin office"
                      userId={admin.id}
                    />
                  )}
                </>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ContactRow({
  name,
  meta,
  userId,
}: {
  name: string;
  meta?: string;
  userId: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-extrabold text-ink-soft">
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink truncate">{name}</div>
        {meta && <div className="text-xs text-muted truncate">{meta}</div>}
      </div>
      <Link
        href={`/parent/messages/with/${userId}`}
        className="shrink-0 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 transition-colors"
      >
        Message
      </Link>
    </div>
  );
}
