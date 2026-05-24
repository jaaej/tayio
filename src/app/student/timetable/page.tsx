import { Card, CardLabel } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { StatusBadge } from "../_components/badge";
import {
  formatDateLong,
  formatTime,
  LESSON_STATUS_LABEL,
  LESSON_STATUS_STYLE,
  parseLessonDate,
  weekKey,
  weekRangeLabel,
} from "../_lib/format";
import { getStudentLessons, type LessonRow } from "../_lib/queries";

export default async function TimetablePage() {
  const user = await requireRole("student");
  const lessons = await getStudentLessons(user.id);

  // Group by ISO week-start (Monday).
  const groups = new Map<string, LessonRow[]>();
  for (const lesson of lessons) {
    const key = weekKey(lesson.date);
    const arr = groups.get(key) ?? [];
    arr.push(lesson);
    groups.set(key, arr);
  }
  const orderedWeeks = [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const todayKey = weekKey(new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-10">
      <header className="rise">
        <CardLabel>Schedule</CardLabel>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Timetable
        </h1>
        <p className="mt-3 text-ink-soft max-w-xl">
          Every lesson across your classes, grouped by week.
        </p>
      </header>

      {orderedWeeks.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No lessons yet. Once you're enrolled and lessons are scheduled,
            they'll show up here.
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {orderedWeeks.map(([weekStart, weekLessons]) => {
            const isCurrentWeek = weekStart === todayKey;
            return (
              <section key={weekStart} className="rise">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
                    Week of {weekRangeLabel(weekStart)}
                  </div>
                  {isCurrentWeek && (
                    <span className="text-[11px] uppercase tracking-[0.18em] text-brand-700">
                      This week
                    </span>
                  )}
                </div>
                <Card className="p-0 overflow-hidden">
                  <div className="divide-y divide-hairline">
                    {weekLessons.map((l) => (
                      <LessonRowItem key={l.id} lesson={l} />
                    ))}
                  </div>
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LessonRowItem({ lesson }: { lesson: LessonRow }) {
  const isPast = parseLessonDate(lesson.date) < new Date(new Date().setHours(0, 0, 0, 0));
  return (
    <div className="grid grid-cols-1 md:grid-cols-[14rem_1fr_auto] gap-3 md:gap-6 px-6 py-4 items-baseline">
      <div>
        <div className="text-sm text-ink">{formatDateLong(lesson.date)}</div>
        <div className="text-xs text-muted">
          {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
        </div>
      </div>
      <div className={isPast ? "text-ink-soft" : "text-ink"}>
        <div className="text-sm">
          {lesson.subjectName}
          <span className="text-muted"> · {lesson.className}</span>
        </div>
        <div className="text-xs text-ink-soft">
          with {lesson.tutorFirstName} {lesson.tutorLastName}
          {lesson.location && ` · ${lesson.location}`}
        </div>
        {lesson.onlineLink && lesson.status === "upcoming" && (
          <a
            href={lesson.onlineLink}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-700 hover:underline"
          >
            Join online →
          </a>
        )}
      </div>
      <div className="md:justify-self-end">
        <StatusBadge
          label={LESSON_STATUS_LABEL[lesson.status] ?? lesson.status}
          className={LESSON_STATUS_STYLE[lesson.status]}
        />
      </div>
    </div>
  );
}
