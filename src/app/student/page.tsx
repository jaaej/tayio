import Link from "next/link";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { StatusBadge } from "./_components/badge";
import {
  formatDateLong,
  formatDueDate,
  formatTime,
  formatWeekday,
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
  LESSON_STATUS_LABEL,
  LESSON_STATUS_STYLE,
  parseLessonDate,
} from "./_lib/format";
import {
  getDueHomeworkCount,
  getNextDueHomework,
  getNextLesson,
  getStudentLessons,
  getStudentLessonsWithNotes,
} from "./_lib/queries";

const dayMs = 24 * 60 * 60 * 1000;

export default async function StudentDashboard() {
  const user = await requireRole("student");
  const firstName = (user.user_metadata?.first_name as string) ?? "there";

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * dayMs);

  const [nextLesson, nextHomework, dueCount, weekLessons, recentRecaps] =
    await Promise.all([
      getNextLesson(user.id),
      getNextDueHomework(user.id),
      getDueHomeworkCount(user.id),
      getStudentLessons(user.id, { from: weekStart }),
      getStudentLessonsWithNotes(user.id),
    ]);

  const lessonsThisWeek = weekLessons.filter(
    (l) => parseLessonDate(l.date) < weekEnd,
  );

  const recentRecap = recentRecaps.find((l) => l.hasNote);

  const today = new Date();
  const termLabel = `${today.toLocaleDateString("en-AU", { weekday: "long" })} · ${today.toLocaleDateString("en-AU", { day: "numeric", month: "long" })}`;

  return (
    <div className="space-y-12">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          {termLabel}
        </div>
        <h1 className="mt-2 text-5xl lg:text-6xl font-light tracking-tight text-ink">
          Welcome back, <span className="font-display italic">{firstName}</span>.
        </h1>
        <p className="mt-4 text-ink-soft max-w-xl">
          {nextLesson || nextHomework
            ? "Here's what's coming up."
            : "All clear — nothing scheduled and no homework due."}
        </p>
      </header>

      <section
        className="grid lg:grid-cols-3 gap-5 rise"
        style={{ animationDelay: "80ms" }}
      >
        <Card>
          <CardLabel>Next class</CardLabel>
          {nextLesson ? (
            <>
              <CardTitle>{nextLesson.subjectName}</CardTitle>
              <div className="mt-6 space-y-1 text-sm text-ink-soft">
                <div>
                  {formatWeekday(nextLesson.date)} · {formatTime(nextLesson.startTime)}
                </div>
                <div>
                  with {nextLesson.tutorFirstName} {nextLesson.tutorLastName}
                </div>
                {nextLesson.onlineLink ? (
                  <a
                    href={nextLesson.onlineLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    Join online →
                  </a>
                ) : nextLesson.location ? (
                  <div>{nextLesson.location}</div>
                ) : null}
                <div className="pt-2">
                  <StatusBadge
                    label={LESSON_STATUS_LABEL[nextLesson.status] ?? nextLesson.status}
                    className={LESSON_STATUS_STYLE[nextLesson.status]}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <CardTitle>No upcoming class</CardTitle>
              <div className="mt-6 text-sm text-ink-soft">
                Your timetable is empty right now. Check back later or ask your tutor.
              </div>
            </>
          )}
        </Card>

        <Card>
          <CardLabel>Homework due</CardLabel>
          {nextHomework ? (
            <>
              <CardTitle>
                <Link
                  href={`/student/homework/${nextHomework.homeworkId}`}
                  className="hover:underline"
                >
                  {nextHomework.title}
                </Link>
              </CardTitle>
              <div className="mt-6 space-y-1 text-sm text-ink-soft">
                <div>Due {formatDueDate(nextHomework.dueDate)}</div>
                {nextHomework.className && <div>{nextHomework.className}</div>}
                <div className="pt-2">
                  <StatusBadge
                    label={HOMEWORK_STATUS_LABEL[nextHomework.status] ?? nextHomework.status}
                    className={HOMEWORK_STATUS_STYLE[nextHomework.status]}
                  />
                </div>
                {dueCount > 1 && (
                  <div className="pt-1 text-xs text-muted">
                    +{dueCount - 1} more in your list
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <CardTitle>Nothing due</CardTitle>
              <div className="mt-6 text-sm text-ink-soft">
                You're all caught up.
              </div>
            </>
          )}
        </Card>

        <Card>
          <CardLabel>Recent recap</CardLabel>
          {recentRecap ? (
            <>
              <CardTitle>
                <Link
                  href={`/student/lessons/${recentRecap.lessonId}`}
                  className="hover:underline"
                >
                  {recentRecap.subjectName}
                </Link>
              </CardTitle>
              <div className="mt-6 space-y-1 text-sm text-ink-soft">
                <div>{formatDateLong(recentRecap.date)}</div>
                <div className="text-xs text-muted">{recentRecap.className}</div>
                <Link
                  href={`/student/lessons/${recentRecap.lessonId}`}
                  className="text-brand-700 hover:underline inline-block pt-2"
                >
                  Read recap →
                </Link>
              </div>
            </>
          ) : (
            <>
              <CardTitle>No recaps yet</CardTitle>
              <div className="mt-6 text-sm text-ink-soft">
                Lesson recaps appear here once your tutor adds notes.
              </div>
            </>
          )}
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "160ms" }}>
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            This week
          </div>
          <Link
            href="/student/timetable"
            className="text-xs text-brand-700 hover:underline"
          >
            Full timetable →
          </Link>
        </div>
        <Card className="p-0 overflow-hidden">
          {lessonsThisWeek.length === 0 ? (
            <div className="px-6 py-8 text-sm text-ink-soft">
              No lessons scheduled this week.
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {lessonsThisWeek.map((l) => (
                <div
                  key={l.id}
                  className="flex items-baseline gap-6 px-6 py-4"
                >
                  <div className="w-12 text-[11px] uppercase tracking-[0.18em] text-muted">
                    {formatWeekday(l.date, "short")}
                  </div>
                  <div className="w-20 text-sm text-ink">
                    {formatTime(l.startTime)}
                  </div>
                  <div className="flex-1 text-sm text-ink-soft">
                    {l.subjectName} with {l.tutorFirstName} {l.tutorLastName}
                  </div>
                  <StatusBadge
                    label={LESSON_STATUS_LABEL[l.status] ?? l.status}
                    className={LESSON_STATUS_STYLE[l.status]}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
