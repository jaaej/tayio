import { Card, CardHead, CardBody } from "@/components/student/card";
import { Badge } from "@/components/student/pill";
import { StudentHero } from "@/components/student/student-hero";
import { SubjectCard } from "@/components/student/subject-card";
import { QuestRow } from "@/components/student/quest-row";
import { TodayTimeline, type TimelineItem } from "@/components/student/today-timeline";
import { StatTile } from "@/components/student/kpi";
import {
  MiniWeekCalendar,
  type CalendarEvent,
} from "@/components/data/mini-week-calendar";
import { requireRole } from "@/lib/auth";
import {
  formatMoney,
  formatTime,
  formatWeekday,
  isoDate,
  relativeTime,
  startOfMondayWeek,
} from "@/lib/format";
import {
  getAdminContactForStudent,
  getNextLesson,
  getOutstandingBalanceForStudent,
  getRelevantAnnouncements,
  getStudentHomework,
  getStudentLessons,
  getStudentSubjects,
  getStudentTutors,
} from "./_lib/queries";
import { StudentContacts } from "@/components/student/contacts";

export default async function StudentDashboard() {
  const user = await requireRole("student");
  const isUnrestricted =
    (user.app_metadata?.role as string | undefined) === "student_unrestricted";
  const outstanding = isUnrestricted
    ? await getOutstandingBalanceForStudent(user.id)
    : 0;

  const firstName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Student";
  const lastName = (user.user_metadata?.last_name as string | undefined) ?? "";
  const initials = (
    firstName.charAt(0) + (lastName.charAt(0) || "")
  ).toUpperCase();
  const yearLevel = (user.user_metadata?.year_level as string | undefined) ?? null;

  const now = new Date();
  const weekStart = startOfMondayWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const todayIso = isoDate(now);

  const [subjects, nextLesson, allHomework, weekLessons, notices, tutors, adminContact] =
    await Promise.all([
      getStudentSubjects(user.id),
      getNextLesson(user.id),
      getStudentHomework(user.id),
      getStudentLessons(user.id, { from: weekStart }),
      getRelevantAnnouncements(user.id, 4),
      getStudentTutors(user.id),
      isUnrestricted ? getAdminContactForStudent() : Promise.resolve(null),
    ]);

  const openHomework = allHomework
    .filter(
      (h) =>
        h.status === "not_started" ||
        h.status === "viewed" ||
        h.status === "resubmission_requested",
    )
    .slice(0, 5);

  const todayLessons = weekLessons.filter((l) => l.date === todayIso);
  const todayItems: TimelineItem[] = todayLessons.map((l) => {
    const start = parseHHMM(l.startTime);
    const end = parseHHMM(l.endTime);
    const durHours = (end - start) / 60;
    return {
      time: l.startTime.slice(0, 5),
      duration: durHours >= 1 ? `${trimZero(durHours)}h` : `${end - start}m`,
      title: l.subjectName,
      sub: l.className ?? "",
      subjectName: l.subjectName,
    };
  });

  // Week calendar events
  const calendarEvents: CalendarEvent[] = [];
  for (const l of weekLessons) {
    const d = new Date(`${l.date}T00:00:00`);
    if (d < weekStart || d >= weekEnd) continue;
    calendarEvents.push({
      date: l.date,
      time: l.startTime.slice(0, 5),
      endTime: l.endTime.slice(0, 5),
      label: l.subjectName,
      kind: "lesson",
    });
  }
  for (const h of allHomework) {
    const due = new Date(h.dueDate);
    if (due < weekStart || due >= weekEnd) continue;
    if (h.status === "marked" || h.status === "submitted") continue;
    calendarEvents.push({
      date: isoDate(due),
      time: null,
      label: h.title,
      meta: h.className ?? undefined,
      kind: "homework",
      href: `/student/homework/${h.homeworkId}`,
    });
  }

  // Static gamification placeholders.
  const level = 1;
  const xpCurrent = 0;
  const xpToNext = 500;

  return (
    <div className="space-y-5">
      <StudentHero
        firstName={firstName}
        initials={initials}
        yearLevel={yearLevel}
        level={level}
        xpCurrent={xpCurrent}
        xpToNext={xpToNext}
      />

      <div className="grid lg:grid-cols-[2fr_1fr] gap-5 items-start">
        {/* LEFT */}
        <div className="space-y-5 min-w-0">
          <div>
            <SectionHead title="My subjects" actionHref="/student/subjects" actionLabel="All subjects →" />
            {subjects.length === 0 ? (
              <Card>
                <CardBody>
                  <div className="text-sm text-muted">
                    You're not enrolled in any classes yet.
                  </div>
                </CardBody>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {subjects.map((s) => (
                  <SubjectCard
                    key={s.classId}
                    name={s.subjectName}
                    mastery={s.masteryPercent}
                    nextLabel={
                      nextLesson && nextLesson.subjectName === s.subjectName
                        ? `${formatWeekday(nextLesson.date, "short")} ${formatTime(nextLesson.startTime)}`
                        : undefined
                    }
                    href={`/student/subjects/${s.subjectId}`}
                  />
                ))}
              </div>
            )}
          </div>

          <Card accent="var(--sky)" className="overflow-hidden">
            <CardHead
              title="This week"
              action={<a href="/student/timetable">Full timetable →</a>}
            />
            <CardBody>
              <MiniWeekCalendar
                events={calendarEvents}
                weekStart={weekStart}
              />
            </CardBody>
          </Card>

          <div>
            <SectionHead title="Your quests" actionHref="/student/homework" actionLabel="All homework →" />
            <Card flat accent="var(--mint)" className="overflow-hidden">
              {openHomework.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted">
                  You're caught up - no quests right now 🎉
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {openHomework.map((h) => (
                    <QuestRow
                      key={h.homeworkId}
                      title={h.title}
                      subject={h.className ?? "Homework"}
                      meta={`due ${relativeTime(new Date(h.dueDate))}`}
                      xp={50}
                      done={false}
                      href={`/student/homework/${h.homeworkId}`}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-5 min-w-0">
          {isUnrestricted && (
            <StatTile
              label="Outstanding balance"
              value={formatMoney(outstanding)}
              accent={outstanding > 0 ? "warn" : "success"}
              sub={outstanding > 0 ? "View invoices →" : "All settled"}
              href="/student/payments"
            />
          )}

          <Card accent="var(--sun-500)">
            <CardHead
              title="Today"
              action={<a href="/student/timetable">Timetable →</a>}
            />
            <CardBody className="py-1.5">
              <TodayTimeline items={todayItems} />
            </CardBody>
          </Card>

          <StudentContacts tutors={tutors} admin={adminContact} />

          <Card accent="var(--coral)">
            <CardHead title="Announcements" />
            <CardBody tight>
              {notices.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted">
                  No announcements right now.
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {notices.map((n) => (
                    <div key={n.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-[13px] font-bold text-ink truncate">
                          {n.title}
                        </div>
                        <Badge tone="muted" className="shrink-0">
                          {relativeTime(new Date(n.publishedAt))}
                        </Badge>
                      </div>
                      <p className="text-[12px] text-muted mt-1 leading-snug line-clamp-2">
                        {n.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SectionHead({
  title,
  actionHref,
  actionLabel,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3 px-0.5">
      <h3 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink m-0">
        {title}
      </h3>
      {actionHref && actionLabel && (
        <a
          href={actionHref}
          className="text-[12px] font-bold text-brand-600 hover:text-brand-700"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}

function trimZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}
