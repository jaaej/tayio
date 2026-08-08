import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Flame,
  Inbox,
  Send,
} from "lucide-react";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { SectionHead } from "@/components/student/page-head";
import {
  MiniWeekCalendar,
  type CalendarEvent,
} from "@/components/data/mini-week-calendar";
import {
  formatTime,
  formatWeekday,
  relativeTime,
  startOfMondayWeek,
} from "@/lib/format";
import { requireRole } from "@/lib/auth";
import {
  getLessonsMissingNotes,
  getRecentLessonNotes,
  getStudentsToBump,
  getSubmissionsToMark,
  getTutorWeekLessons,
  requireTutor,
} from "./_data";


export default async function TutorDashboard() {
  const user = await requireRole("tutor");
  const tutor = await requireTutor();
  const firstName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Tutor";
  const initials =
    ((user.user_metadata?.first_name as string | undefined)?.charAt(0) ??
      firstName.charAt(0)) +
    ((user.user_metadata?.last_name as string | undefined)?.charAt(0) ?? "");

  const now = new Date();
  const weekStart = startOfMondayWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [
    weekLessons,
    submissions,
    missingNotes,
    recentNotes,
    bumpRows,
  ] = await Promise.all([
    getTutorWeekLessons(tutor.id, weekStart, weekEnd),
    getSubmissionsToMark(tutor.id, 9),
    getLessonsMissingNotes(tutor.id, 5),
    getRecentLessonNotes(tutor.id, 4),
    getStudentsToBump(tutor.id, 12),
  ]);

  // Split submissions into Late vs On-time so the card can render two
  // visually distinct subsections instead of a uniform 3-col grid that
  // hides which ones are most urgent.
  const lateSubmissions = submissions
    .filter((s) => s.status === "late")
    .sort(
      (a, b) =>
        (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
    );
  const onTimeSubmissions = submissions
    .filter((s) => s.status !== "late")
    .sort(
      (a, b) =>
        (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
    );
  const lateCount = lateSubmissions.length;

  // Bucket bump rows by student so each name shows once with a count.
  const bumpByStudent = new Map<
    string,
    {
      studentId: string;
      firstName: string;
      lastName: string;
      items: typeof bumpRows;
      oldestDue: Date;
    }
  >();
  for (const r of bumpRows) {
    const existing = bumpByStudent.get(r.studentId);
    if (existing) {
      existing.items.push(r);
      if (r.dueDate < existing.oldestDue) existing.oldestDue = r.dueDate;
    } else {
      bumpByStudent.set(r.studentId, {
        studentId: r.studentId,
        firstName: r.firstName,
        lastName: r.lastName,
        items: [r],
        oldestDue: r.dueDate,
      });
    }
  }
  const bumpList = Array.from(bumpByStudent.values()).sort(
    (a, b) => a.oldestDue.getTime() - b.oldestDue.getTime(),
  );

  const events: CalendarEvent[] = weekLessons.map((l) => ({
    date: l.date,
    time: l.startTime.slice(0, 5),
    endTime: l.endTime.slice(0, 5),
    label: l.className,
    meta: l.subjectName,
    kind: "lesson",
    href: `/tutor/lessons/${l.id}`,
  }));

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayLessons = weekLessons.filter(
    (l) => String(l.date).slice(0, 10) === todayStr,
  );

  const dateLabel = now.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      {/* Hero band - soft brand gradient, time-based greeting, avatar +
        * next-up callout. Replaces the plain PageHead so the page opens
        * with a clear sense of "here's where you are today". */}
      <section
        className="relative overflow-hidden rounded-[20px] px-6 py-5 lg:px-7 lg:py-6 text-white"
        style={{
          background:
            "radial-gradient(120% 140% at 0% 0%, #A0BFFC 0%, transparent 50%), linear-gradient(125deg, #4F5BD5 0%, #3F4AB5 60%, #2B3287 100%)",
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute -right-6 -top-8 w-[180px] h-[180px] opacity-40 pointer-events-none"
          fill="none"
        >
          <circle cx="70" cy="30" r="30" fill="rgba(255,255,255,0.10)" />
          <circle cx="70" cy="30" r="20" fill="rgba(255,255,255,0.10)" />
          <circle cx="70" cy="30" r="10" fill="rgba(255,255,255,0.12)" />
        </svg>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
          <div className="h-12 w-12 lg:h-14 lg:w-14 rounded-[14px] grid place-items-center text-[18px] lg:text-[20px] font-extrabold text-white border border-white/40 bg-white/[0.16] backdrop-blur-sm shrink-0">
            {initials.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.16em] font-bold opacity-85">
              {dateLabel}
            </div>
            <h1 className="m-0 mt-1 text-[24px] lg:text-[28px] font-extrabold tracking-[-0.01em] leading-tight">
              {greeting}, {firstName}
            </h1>
          </div>
        </div>
      </section>

      {todayLessons.length > 0 && (
        <section className="space-y-2.5">
          <SectionHead title="Today's classes" />
          <div className="grid gap-3 sm:grid-cols-2">
            {todayLessons.map((l) => (
              <Link
                key={l.id}
                href={`/tutor/lessons/${l.id}`}
                className="block group"
              >
                <Card className="border-brand-200 transition-all duration-150 group-hover:-translate-y-[3px] group-hover:shadow-[0_14px_28px_-16px_rgba(31,40,90,0.5)]">
                  <CardBody>
                    <div className="flex items-center gap-3">
                      <span className="grid place-items-center h-11 w-11 rounded-[12px] bg-brand-100 text-brand-700 shrink-0">
                        <ClipboardCheck
                          className="h-[22px] w-[22px]"
                          strokeWidth={2.2}
                          aria-hidden
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted">
                          {l.subjectName}
                        </div>
                        <div className="text-[14px] font-extrabold text-ink leading-tight truncate">
                          {l.className}
                        </div>
                        <div className="text-[12px] text-muted tabular-nums">
                          {formatTime(l.startTime)}–{formatTime(l.endTime)}
                        </div>
                      </div>
                      <span className="text-[13px] font-bold text-brand-700 shrink-0">
                        View class →
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-5 min-w-0">
          <Card className="overflow-hidden">
            <CardHead
              title="This week"
              action={<Link href="/tutor/timetable">Open timetable →</Link>}
            />
            <CardBody>
              <MiniWeekCalendar events={events} weekStart={weekStart} />
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <RichHeader
              icon={<Inbox className="h-4 w-4" />}
              iconBg="bg-brand-600"
              title="Submissions to mark"
              actionHref="/tutor/homework"
              actionLabel="All homework"
              countBadge={submissions.length}
              tone={lateCount > 0 ? "bad" : submissions.length > 0 ? "brand" : "good"}
            />
            {submissions.length === 0 ? (
              <CardBody tight>
                <EmptyState
                  icon={<CheckCircle2 className="h-7 w-7" />}
                  title="All marked"
                  body="New submissions will appear here as students submit."
                />
              </CardBody>
            ) : (
              /* Late and Submitted sit side by side on desktop when both
               * exist; either one alone takes the full width. Collapses
               * back to stacked below lg. */
              <div
                className={
                  lateCount > 0 && onTimeSubmissions.length > 0
                    ? "grid lg:grid-cols-2 lg:divide-x lg:divide-line"
                    : undefined
                }
              >
                {lateCount > 0 && (
                  <div className="min-w-0">
                    <BandedSubsection
                      label="Late - review first"
                      count={lateCount}
                      tone="bad"
                      icon={<Flame className="h-3.5 w-3.5" />}
                    />
                    <div className="p-3.5 grid sm:grid-cols-2 gap-3 items-start">
                      {lateSubmissions.map((s) => (
                        <SubmissionCard
                          key={`${s.homeworkId}-${s.studentId}`}
                          submission={s}
                          urgent
                        />
                      ))}
                    </div>
                  </div>
                )}
                {onTimeSubmissions.length > 0 && (
                  <div className="min-w-0">
                    <BandedSubsection
                      label="Submitted"
                      count={onTimeSubmissions.length}
                      tone="good"
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    />
                    <div className="p-3.5 grid sm:grid-cols-2 gap-3 items-start">
                      {onTimeSubmissions.map((s) => (
                        <SubmissionCard
                          key={`${s.homeworkId}-${s.studentId}`}
                          submission={s}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <RichHeader
              icon={<BellRing className="h-4 w-4" />}
              iconBg="bg-coral"
              title="Students to bump"
              countBadge={bumpList.length}
              tone={bumpList.length > 0 ? "bad" : "good"}
            />
            {bumpList.length === 0 ? (
              <CardBody tight>
                <EmptyState
                  icon={<CheckCircle2 className="h-7 w-7" />}
                  title="No overdue work"
                  body="Your students are caught up on their homework."
                />
              </CardBody>
            ) : (
              <div className="p-4 grid sm:grid-cols-2 gap-3.5">
                {bumpList.map((b) => (
                  <BumpCard key={b.studentId} bump={b} />
                ))}
              </div>
            )}
          </Card>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card className="overflow-hidden">
              <CardHead
                title="Lessons missing a note"
                action={
                  missingNotes.length > 0
                    ? `${missingNotes.length} in last 7d`
                    : "Up to date"
                }
              />
              <CardBody tight>
                {missingNotes.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted text-center">
                    Every recent lesson is documented.
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {missingNotes.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`/tutor/lessons/${l.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                        >
                          <div className="w-20 text-[12px] tabular-nums text-muted shrink-0">
                            {formatWeekday(l.date, "short")}{" "}
                            {formatTime(l.startTime)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-bold text-ink truncate">
                              {l.className}
                            </div>
                            <div className="text-[11px] text-muted mt-0.5 truncate">
                              {l.subjectName}
                            </div>
                          </div>
                          <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600 shrink-0">
                            Write note →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardHead title="Recent notes" />
              <CardBody tight>
                {recentNotes.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted text-center">
                    No notes yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {recentNotes.map((n) => (
                      <li key={n.id}>
                        <Link
                          href={`/tutor/students/${n.studentId}`}
                          className="block px-4 py-3 hover:bg-surface-2 transition-colors"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="text-[13px] font-bold text-ink truncate">
                              {n.studentFirstName} {n.studentLastName}
                            </div>
                            <span className="text-[11px] text-muted shrink-0">
                              {relativeTime(new Date(n.createdAt))}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-muted leading-snug line-clamp-2">
                            {n.topicCovered ??
                              n.parentVisibleComment ??
                              n.internalNote ??
                              n.className}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
      </div>
    </div>
  );
}

/** Plain card header with icon tile, tagline, count badge, optional CTA.
 * (Background is intentionally neutral - color lives in the row cards
 * below, not on the title block.) */
function RichHeader({
  icon,
  iconBg,
  title,
  tagline,
  actionHref,
  actionLabel,
  countBadge,
  tone,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  tagline?: string;
  actionHref?: string;
  actionLabel?: string;
  countBadge?: number;
  tone: "brand" | "good" | "bad";
}) {
  const badgeCls =
    tone === "bad"
      ? "bg-bad text-white"
      : tone === "good"
        ? "bg-good text-white"
        : "bg-brand-600 text-white";
  return (
    <div className="px-4 py-3.5 border-b border-line flex items-center justify-between gap-3 bg-surface">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-9 w-9 rounded-[10px] grid place-items-center text-white shrink-0 ${iconBg}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="m-0 text-[14px] font-extrabold text-ink truncate">
              {title}
            </h3>
            {typeof countBadge === "number" && countBadge > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-extrabold leading-none tabular-nums ${badgeCls}`}
              >
                {countBadge}
              </span>
            )}
          </div>
          {tagline && (
            <p className="text-[11px] text-muted mt-0.5 truncate">{tagline}</p>
          )}
        </div>
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-brand-600 hover:text-brand-700"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

/** Sub-section divider used inside a card, with a colored band + icon. */
function BandedSubsection({
  label,
  count,
  tone,
  icon,
}: {
  label: string;
  count: number;
  tone: "bad" | "good";
  icon?: React.ReactNode;
}) {
  const cls =
    tone === "bad"
      ? "bg-bad-bg text-bad border-bad/30"
      : "bg-good-bg text-good border-good/30";
  return (
    <div
      className={`flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-[0.14em] font-extrabold border-y ${cls}`}
    >
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="tabular-nums">{count}</span>
    </div>
  );
}

/** Friendly empty-state callout with a soft tinted icon. */
function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full grid place-items-center bg-good-bg text-good mb-2.5">
        {icon}
      </div>
      <div className="text-[13px] font-extrabold text-ink">{title}</div>
      <div className="text-[12px] text-muted mt-1 max-w-xs mx-auto">
        {body}
      </div>
    </div>
  );
}

type SubmissionItem = {
  homeworkId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  title: string;
  className: string | null;
  status: string;
  submittedAt: Date | null;
};

function SubmissionCard({
  submission: s,
  urgent = false,
}: {
  submission: SubmissionItem;
  urgent?: boolean;
}) {
  // Subtle background tint differentiates state at a glance - coral wash
  // for late, brand wash for on-time.
  const cardCls = urgent
    ? "bg-gradient-to-br from-bad-bg via-surface to-surface border-bad/40"
    : "bg-gradient-to-br from-brand-50/60 via-surface to-surface border-brand-100";
  const avatarCls = urgent
    ? "bg-bad text-white ring-bad/15"
    : "bg-brand-500 text-white ring-brand-100";
  const ctaCls = urgent
    ? "bg-bad hover:opacity-90"
    : "bg-brand-600 hover:bg-brand-700";
  return (
    <Link
      href={`/tutor/homework/${s.homeworkId}`}
      className={`group block rounded-[14px] border p-3 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(15,17,30,0.18)] ${cardCls}`}
    >
      {/* Top: identity */}
      <div className="flex items-start gap-2.5">
        <div
          className={`h-9 w-9 rounded-full grid place-items-center text-[12px] font-extrabold shrink-0 ring-2 ${avatarCls}`}
        >
          {s.firstName.charAt(0)}
          {s.lastName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-ink truncate">
            {s.firstName} {s.lastName}
          </div>
          {s.className && (
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-2 truncate mt-0.5">
              {s.className}
            </div>
          )}
        </div>
        {urgent && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] font-extrabold text-bad bg-white border border-bad/30 rounded-full px-2 py-0.5">
            <Flame className="h-3 w-3" />
            Late
          </span>
        )}
      </div>

      {/* Middle: homework title, single compact line */}
      <div
        className="mt-2 text-[12px] font-bold text-ink line-clamp-1 leading-snug"
        title={s.title}
      >
        {s.title}
      </div>

      {/* Bottom: meta + filled CTA */}
      <div className="mt-2 flex items-center justify-between gap-2">
        {s.submittedAt ? (
          <span className="text-[11px] text-muted flex items-center gap-1 min-w-0">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">{relativeTime(s.submittedAt)}</span>
          </span>
        ) : (
          <span />
        )}
        <span
          className={`inline-flex items-center gap-1 rounded-full text-white px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] font-extrabold transition-all group-hover:translate-x-0.5 shadow-[0_4px_12px_-4px_rgba(50,58,145,0.4)] ${ctaCls}`}
        >
          Mark
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

type BumpItem = {
  studentId: string;
  firstName: string;
  lastName: string;
  items: Array<{ title: string }>;
  oldestDue: Date;
};

function BumpCard({ bump: b }: { bump: BumpItem }) {
  const overdueDays = Math.max(
    0,
    Math.floor((Date.now() - b.oldestDue.getTime()) / 86400000),
  );
  const overdueLabel =
    overdueDays === 0
      ? "Due today"
      : overdueDays === 1
        ? "1 day overdue"
        : `${overdueDays} days overdue`;
  // Severity tier - worst offenders get a coral wash + red ring; mild
  // ones stay calm so the eye picks the real urgency.
  const severity =
    overdueDays >= 7 ? "high" : overdueDays >= 3 ? "med" : "low";
  const cardCls = {
    high: "bg-gradient-to-br from-bad-bg via-surface to-surface border-bad/40",
    med: "bg-gradient-to-br from-warn-bg via-surface to-surface border-warn/30",
    low: "bg-gradient-to-br from-coral-bg/40 via-surface to-surface border-line",
  }[severity];
  const avatarRing = {
    high: "ring-bad/40",
    med: "ring-warn/40",
    low: "ring-coral/30",
  }[severity];
  const dayBadgeCls = {
    high: "bg-bad text-white",
    med: "bg-warn text-white",
    low: "bg-coral-bg text-coral border border-coral/30",
  }[severity];

  return (
    <div
      className={`group rounded-[16px] border p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(15,17,30,0.18)] ${cardCls}`}
    >
      {/* Top: identity + overdue badge */}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div
            className={`h-12 w-12 rounded-full bg-white text-coral grid place-items-center text-[14px] font-extrabold ring-4 ${avatarRing}`}
          >
            {b.firstName.charAt(0)}
            {b.lastName.charAt(0)}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-bad text-white text-[10px] font-extrabold tabular-nums leading-none ring-2 ring-surface">
            {b.items.length}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/tutor/students/${b.studentId}`}
            className="text-[14px] font-extrabold text-ink hover:text-brand-700 truncate block"
          >
            {b.firstName} {b.lastName}
          </Link>
          <div
            className={`mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] font-extrabold rounded-full px-2 py-0.5 ${dayBadgeCls}`}
          >
            <Clock className="h-3 w-3" />
            {overdueLabel}
          </div>
        </div>
      </div>

      {/* Middle: overdue items preview */}
      <div className="mt-3 rounded-[10px] bg-surface border border-line px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted-2">
          {b.items.length} overdue item{b.items.length === 1 ? "" : "s"}
        </div>
        <div className="text-[12px] font-bold text-ink line-clamp-2 leading-snug mt-0.5">
          {b.items.slice(0, 2).map((i) => i.title).join(" · ")}
          {b.items.length > 2 && ` · +${b.items.length - 2} more`}
        </div>
      </div>

      {/* Bottom: dual CTAs */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link
          href={`/tutor/students/${b.studentId}`}
          className="text-[11px] uppercase tracking-[0.12em] font-extrabold text-brand-600 hover:text-brand-700"
        >
          View profile
        </Link>
        <Link
          href={`/tutor/messages/with/${b.studentId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-[11px] uppercase tracking-[0.12em] font-extrabold transition-all group-hover:translate-x-0.5 shadow-[0_4px_12px_-4px_rgba(50,58,145,0.4)]"
        >
          <Send className="h-3.5 w-3.5" />
          Bump
        </Link>
      </div>
    </div>
  );
}
