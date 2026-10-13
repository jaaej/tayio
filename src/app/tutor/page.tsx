import Link from "next/link";
import {
  ArrowLeftRight,
  CircleCheck,
  CircleHelp,
  NotebookPen,
  PenLine,
} from "lucide-react";
import {
  Empty,
  GlassPanel,
  PageHeader,
  Pill,
  SubjectDot,
  buttonVariants,
} from "@/components/admin/ui";
import { TodoPanel, type TodoItem } from "@/components/dashboard/todo-panel";
import { PersonStatusTable } from "@/components/dashboard/person-status-table";
import { WeekPanel } from "@/components/dashboard/week-panel";
import type { TimeGridEvent } from "@/components/data/week-time-grid";
import { requireRole } from "@/lib/auth";
import { classDisplayName } from "@/lib/class-display";
import { termWeekLabel } from "@/lib/curriculum";
import { formatTime, formatTimeRange, weekRangeLabel } from "@/lib/format";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";
import { getTutorCheckinWeek } from "@/lib/tutor-checkins";
import { lessonStartInstant, melbourneDate } from "@/lib/tutor-cover-rules";
import {
  lessonDatesLabel,
  lessonTiming,
  nearDayLabel,
  pickTodaysLesson,
  summariseBumps,
  weekStatusLine,
} from "@/lib/tutor-today";
import { weekStartFromParam } from "@/lib/week-nav";
import { cn } from "@/lib/utils";
import { getRecentLessonNotes, getTutorWeekLessons } from "./_data";
import {
  getClaimableCovers,
  getLessonWeekSummary,
  getMarkingSummary,
  getMissingNotesByClass,
  getOverdueHomework,
  getQuizRequests,
  getTutorDayLessons,
  getTutorUpcomingLesson,
  type DayLesson,
} from "./_lib/today-data";
import { BumpMessageButton } from "./_components/bump-message-button";

export const dynamic = "force-dynamic";

const ICON = "h-[18px] w-[18px]";
const LINE_BUTTON = buttonVariants({ variant: "outline", size: "md" });
const INK_BUTTON = buttonVariants({ variant: "primary", size: "md" });

function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function hoursLabel(minutes: number) {
  const hours = minutes / 60;
  const shown = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
  return `${shown} ${hours === 1 ? "hour" : "hours"}`;
}

function money(value: number) {
  return value.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Last week's check-in when it still waits on the tutor; null otherwise. */
async function getCheckinTodo(tutorId: string, thisWeek: string) {
  const week = addIsoDays(thisWeek, -7);
  const view = await getTutorCheckinWeek(tutorId, week);
  if (view.status !== "pending" || view.totalMinutes === 0) return null;
  return { week, view };
}

export default async function TutorToday({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireRole("tutor");
  const tutorId = user.id;
  const { week } = await searchParams;
  const now = new Date();
  const todayIso = melbourneDate(now);
  const thisWeek = weekStartForIsoDate(todayIso);
  const weekStart = weekStartFromParam(week, todayIso);

  const [
    termLabel,
    dayLessons,
    weekLessons,
    marking,
    missingNotes,
    quizRequests,
    checkin,
    covers,
    overdue,
    recentNotes,
  ] = await Promise.all([
    termWeekLabel(todayIso),
    getTutorDayLessons(tutorId, todayIso),
    getTutorWeekLessons(
      tutorId,
      new Date(`${weekStart}T00:00:00`),
      new Date(`${addIsoDays(weekStart, 7)}T00:00:00`),
    ),
    getMarkingSummary(tutorId),
    getMissingNotesByClass(tutorId, now),
    getQuizRequests(tutorId),
    getCheckinTodo(tutorId, thisWeek),
    getClaimableCovers(tutorId, now),
    getOverdueHomework(tutorId, now),
    getRecentLessonNotes(tutorId, 4),
  ]);

  // Only needed for the empty Today card, and for the week summaries below.
  const [nextLesson, daySummaries] = await Promise.all([
    dayLessons.length === 0 ? getTutorUpcomingLesson(tutorId, now) : null,
    Promise.all(dayLessons.map((l) => getLessonWeekSummary(l))),
  ]);

  const headlineLesson = pickTodaysLesson(dayLessons, now);

  // ---- To do, most urgent first ------------------------------------------
  const todo: TodoItem[] = [];
  if (marking.total > 0) {
    const who = marking.first
      ? `${marking.first.firstName} ${marking.first.lastName}, ${marking.first.title}`
      : null;
    todo.push({
      key: "marking",
      icon: <PenLine className={ICON} aria-hidden />,
      tone: marking.late > 0 ? "bg-bad-bg text-bad" : "bg-brand-50 text-brand-700",
      title: `${plural(marking.total, "submission")} to mark`,
      detail:
        marking.late > 0
          ? `${marking.late} late${who ? ` - ${who}` : ""}`
          : who ?? undefined,
      href: "/tutor/homework",
      action: "Start marking",
    });
  }
  // One row however many classes are behind: the button opens the oldest
  // lesson without a note, where the note is written.
  const missingCount = missingNotes.reduce((n, c) => n + c.dates.length, 0);
  if (missingCount > 0) {
    const first = missingNotes[0];
    const firstLabel = classDisplayName(first.subjectName, first.className);
    const others = missingNotes.length - 1;
    todo.push({
      key: "notes",
      icon: <NotebookPen className={ICON} aria-hidden />,
      tone: "bg-warn-bg text-warn",
      title:
        missingCount === 1
          ? "1 lesson is missing a note"
          : `${missingCount} lessons are missing a note`,
      detail:
        others === 0
          ? `${firstLabel} · ${lessonDatesLabel(first.dates)}`
          : `${firstLabel} and ${plural(others, "other class", "other classes")}`,
      href: `/tutor/lessons/${first.oldestLessonId}`,
      action: "Write notes",
    });
  }
  for (const q of quizRequests) {
    const changes = q.status === "changes_requested";
    todo.push({
      key: `quiz-${q.id}`,
      icon: <CircleHelp className={ICON} aria-hidden />,
      tone: "bg-brand-50 text-brand-700",
      title: `${changes ? "Quiz changes requested" : "Quiz requested"}: ${q.subjectName}, Week ${q.weekNumber}`,
      detail: q.note?.trim() || q.title,
      href: q.href,
      action: "Open week",
    });
  }
  if (checkin) {
    const { view } = checkin;
    todo.push({
      key: "checkin",
      icon: <CircleCheck className={ICON} aria-hidden />,
      tone: "bg-good-bg text-good",
      title: "Confirm last week's hours",
      detail: [
        hoursLabel(view.totalMinutes),
        view.hasMissingRate ? null : money(view.totalPay),
        weekRangeLabel(checkin.week),
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/tutor/checkin?week=${checkin.week}`,
      action: "Review",
    });
  }
  if (covers.length > 0) {
    const soonest = covers[0];
    const day = nearDayLabel(soonest.date, todayIso);
    todo.push({
      key: "cover",
      icon: <ArrowLeftRight className={ICON} aria-hidden />,
      tone: "bg-info-bg text-info",
      title:
        covers.length === 1 ? "1 class needs cover" : `${covers.length} classes need cover`,
      detail: `Soonest: ${classDisplayName(soonest.subjectName, soonest.className)}, ${
        day === "Today" || day === "Tomorrow" ? day.toLowerCase() : day
      } ${formatTime(soonest.startTime)}`,
      href: "/tutor/cover",
      action: "View board",
    });
  }

  // ---- This week -----------------------------------------------------------
  const events: TimeGridEvent[] = weekLessons
    .filter((l) => l.status !== "cancelled" && l.status !== "rescheduled")
    .map((l) => ({
      id: l.id,
      date: l.date,
      startTime: l.startTime,
      endTime: l.endTime,
      // The block is narrow: subject only, full class name in the tooltip
      // (same as the admin dashboard).
      label: l.subjectName,
      title: classDisplayName(l.subjectName, l.className),
      subject: l.subjectName,
      href: `/tutor/lessons/${l.id}`,
    }));

  const bumps = summariseBumps(overdue, todayIso).slice(0, 6);

  const dateLabel = new Date(`${todayIso}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "there";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting(now)}, ${firstName}`}
        sub={`${dateLabel}${termLabel ? ` · ${termLabel}` : ""}`}
        actions={
          <>
            <Link
              href="/tutor/timetable?panel=leave"
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              Report absence
            </Link>
            {headlineLesson && (
              <Link
                href={`/tutor/lessons/${headlineLesson.id}`}
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                Open today&rsquo;s lesson
              </Link>
            )}
          </>
        }
      />

      <div className="rise grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" style={{ animationDelay: "40ms" }}>
        <TodoPanel empty="All clear. Nothing needs you right now." items={todo} />

        <GlassPanel
          title="Today"
          meta={dayLessons.length > 0 ? plural(dayLessons.length, "lesson") : undefined}
        >
          {dayLessons.length === 0 ? (
            <Empty>
              No lessons today.
              {nextLesson && (
                <>
                  {" "}
                  Next:{" "}
                  <Link
                    href={`/tutor/lessons/${nextLesson.id}`}
                    className="font-bold text-brand-700 hover:underline"
                  >
                    {classDisplayName(nextLesson.subjectName, nextLesson.className)},{" "}
                    {nearDayLabel(nextLesson.date, todayIso)} {formatTime(nextLesson.startTime)}
                  </Link>
                </>
              )}
            </Empty>
          ) : (
            <ul className="divide-y divide-line">
              {dayLessons.map((l, i) => (
                <TodayLesson
                  key={l.id}
                  lesson={l}
                  summary={daySummaries[i]}
                  now={now}
                  todayIso={todayIso}
                />
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>

      <WeekPanel
        className="rise"
        basePath="/tutor"
        weekStart={weekStart}
        todayIso={todayIso}
        events={events}
        noun="lesson"
        calendarHref="/tutor/timetable"
        calendarLabel="Open calendar"
      />

      <div className="rise grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <GlassPanel
          title="Students to bump"
          action={
            <Link
              href="/tutor/students"
              className="pr-1.5 text-[13px] font-bold text-brand-600 hover:text-brand-700"
            >
              All students
            </Link>
          }
        >
          <PersonStatusTable
            empty="No overdue homework. Your students are caught up."
            rows={bumps.map((b) => ({
              id: b.studentId,
              firstName: b.firstName,
              lastName: b.lastName,
              context: b.className,
              reason: b.reason,
              tone: b.tone,
              href: `/tutor/students/${b.studentId}`,
              action: <BumpMessageButton studentId={b.studentId} />,
            }))}
          />
        </GlassPanel>

        <GlassPanel
          title="Recent notes"
          action={
            <Link
              href="/tutor/students"
              className="pr-1.5 text-[13px] font-bold text-brand-600 hover:text-brand-700"
            >
              All notes
            </Link>
          }
        >
          {recentNotes.length === 0 ? (
            <Empty>No lesson notes yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {recentNotes.map((n) => {
                const text =
                  n.parentVisibleComment?.trim() ||
                  n.topicCovered?.trim() ||
                  n.internalNote?.trim() ||
                  null;
                return (
                  <li key={n.id}>
                    <Link
                      href={`/tutor/students/${n.studentId}`}
                      className="block px-4 py-3 transition-colors hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[14px] font-bold text-ink">
                          {n.studentFirstName} {n.studentLastName}
                        </span>
                        <span className="truncate text-[12px] text-muted">{n.className}</span>
                        <span className="ml-auto shrink-0 text-[12px] text-muted">
                          {nearDayLabel(n.lessonDate, todayIso)}
                        </span>
                      </span>
                      {text && (
                        <span className="mt-0.5 line-clamp-2 block text-[13px] leading-[1.45] text-ink-soft">
                          {text}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}

const WEEKDAY_TILE = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" });

function TodayLesson({
  lesson: l,
  summary,
  now,
  todayIso,
}: {
  lesson: DayLesson;
  summary: Awaited<ReturnType<typeof getLessonWeekSummary>>;
  now: Date;
  todayIso: string;
}) {
  const timing = lessonTiming(l.date, l.startTime, l.endTime, now);
  const lessonDone =
    lessonStartInstant(l.date, l.endTime).getTime() <= now.getTime();
  const meta = [
    formatTimeRange(l.startTime, l.endTime),
    l.place,
    plural(l.studentCount, "student"),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-3">
        <span className="flex w-[46px] shrink-0 flex-col items-center leading-[1.1]">
          <span className="text-[11px] font-extrabold uppercase text-muted">
            {WEEKDAY_TILE.format(new Date(`${l.date}T00:00:00Z`))}
          </span>
          <span className="text-[20px] font-extrabold tabular-nums text-ink">
            {Number(l.date.slice(8))}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-start gap-1.5 text-[15px] font-extrabold leading-snug text-ink">
            <SubjectDot subject={l.subjectName} className="mt-[6px]" />
            <span className="min-w-0">{classDisplayName(l.subjectName, l.className)}</span>
          </span>
          <span className="text-[13px] text-muted">{meta}</span>
        </span>
        <Pill tone={timing.tone === "neutral" ? "default" : timing.tone} className="shrink-0">
          {timing.label}
        </Pill>
      </div>

      {summary && (
        <div className="flex flex-col gap-1 rounded-[12px] bg-[#F6F7FA] p-3">
          <span className="text-[12px] font-extrabold uppercase text-muted">
            This week&rsquo;s topic
          </span>
          <span className="text-[14px] font-bold text-ink">
            Week {summary.weekNumber} · {summary.title}
          </span>
          <span className="text-[12px] text-muted">
            {weekStatusLine({
              hasRecording: Boolean(l.recordingUrl),
              lessonDone,
              quizStatus: summary.quizStatus,
              homeworkDueIso: summary.homeworkDueIso,
              todayIso,
            })}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href={`/tutor/classes/${l.classId}/curriculum`} className={cn(LINE_BUTTON, "h-[38px]")}>
          Week plan
        </Link>
        <Link href={`/tutor/lessons/${l.id}`} className={cn(INK_BUTTON, "h-[38px]")}>
          Mark attendance
        </Link>
      </div>
    </li>
  );
}
