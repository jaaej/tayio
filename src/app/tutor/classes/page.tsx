import Link from "next/link";
import {
  Empty,
  PageHeader,
  Pill,
  buttonVariants,
} from "@/components/admin/ui";
import { classDisplayName } from "@/lib/class-display";
import { formatTime, formatTimeRange } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { lessonTiming, nearDayLabel } from "@/lib/tutor-today";
import { getLessonWeek } from "@/lib/week-plans";
import { cn } from "@/lib/utils";
import { getTutorClasses, requireTutor } from "../_data";
import {
  getLessonWeekSummary,
  getTutorUpcomingLesson,
} from "../_lib/today-data";
import { getNextLessonDateByClass } from "./_lib/queries";

export const dynamic = "force-dynamic";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LINE_BUTTON = buttonVariants({ variant: "outline", size: "md" });

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function TutorClassesPage() {
  const tutor = await requireTutor();
  const now = new Date();
  const todayIso = melbourneDate(now);

  const [list, nextLesson, nextByClass] = await Promise.all([
    getTutorClasses(tutor.id),
    getTutorUpcomingLesson(tutor.id, now),
    getNextLessonDateByClass(tutor.id, todayIso),
  ]);

  const [nextSummary, weeks] = await Promise.all([
    nextLesson ? getLessonWeekSummary(nextLesson) : null,
    Promise.all(list.map((c) => getLessonWeek(c.id, todayIso))),
  ]);
  const weekByClass = new Map(list.map((c, i) => [c.id, weeks[i]]));

  // Classes with a lesson coming up first, soonest first; the rest by name.
  const sorted = [...list].sort((a, b) => {
    const na = nextByClass.get(a.id);
    const nb = nextByClass.get(b.id);
    if (na && nb && na !== nb) return na.localeCompare(nb);
    if (na && !nb) return -1;
    if (!na && nb) return 1;
    return (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.name.localeCompare(b.name);
  });

  const isToday = nextLesson?.date === todayIso;
  const timing = nextLesson
    ? lessonTiming(nextLesson.date, nextLesson.startTime, nextLesson.endTime, now)
    : null;
  const [clock, meridiem] = nextLesson
    ? formatTime(nextLesson.startTime).replace(/(am|pm)$/, " $1").split(" ")
    : ["", ""];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Classes"
        actions={
          <Link
            href="/tutor/timetable"
            className={buttonVariants({ variant: "glass", size: "lg" })}
          >
            Open timetable
          </Link>
        }
      />

      {nextLesson && (
        <section aria-labelledby="next-class" className="glass rise rounded-[24px] p-1.5">
          <div className="panel flex flex-wrap items-center gap-4 px-[18px] py-4">
            <span className="flex w-[52px] shrink-0 flex-col items-center leading-[1.1]">
              <span className="text-[11px] font-extrabold uppercase text-muted">
                {isToday ? "Today" : nearDayLabel(nextLesson.date, todayIso)}
              </span>
              <span className="text-[22px] font-extrabold tabular-nums text-ink">{clock}</span>
              <span className="text-[11px] font-extrabold uppercase text-muted">{meridiem}</span>
            </span>
            <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-[3px]">
              <span className="flex flex-wrap items-center gap-2">
                <h2 id="next-class" className="text-[18px] font-extrabold text-ink">
                  {classDisplayName(nextLesson.subjectName, nextLesson.className)}
                </h2>
                {isToday && timing && (
                  <Pill
                    tone={timing.tone === "neutral" ? "default" : timing.tone}
                    className="h-[22px] px-2 text-[11px]"
                  >
                    {timing.label}
                  </Pill>
                )}
              </span>
              <span className="text-[13px] text-muted">
                {[
                  nextSummary ? `Week ${nextSummary.weekNumber} · ${nextSummary.title}` : null,
                  isToday ? null : formatTimeRange(nextLesson.startTime, nextLesson.endTime),
                  nextLesson.place,
                  plural(nextLesson.studentCount, "student"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/tutor/classes/${nextLesson.classId}/curriculum`}
                className={cn(LINE_BUTTON, "h-10 rounded-[11px]")}
              >
                Week plan
              </Link>
              <Link
                href={`/tutor/lessons/${nextLesson.id}`}
                className={cn(buttonVariants({ variant: "primary", size: "md" }), "h-10 rounded-[11px] px-4")}
              >
                Open lesson
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Same frame as GlassPanel, but each class card is its own white
          panel on the glass instead of one shared body. */}
      <section aria-labelledby="your-classes" className="glass rise flex min-w-0 flex-col rounded-[24px] p-1.5">
        <div className="flex min-h-12 items-center py-1.5 pl-3 pr-1.5">
          <h2 id="your-classes" className="text-[16px] font-extrabold text-ink">
            Your classes
          </h2>
        </div>
        {sorted.length === 0 ? (
          <div className="panel">
            <Empty>An admin needs to assign you to a class before it appears here.</Empty>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-1.5">
            {sorted.map((c) => {
              const tone = subjectTone(c.subjectName);
              const name = classDisplayName(c.subjectName, c.name);
              const week = weekByClass.get(c.id);
              const capacity = c.capacity ?? 0;
              const enrolled = c.enrolledCount ?? 0;
              const full = capacity > 0 && enrolled >= capacity;
              const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
              const when =
                typeof c.weekday === "number" && c.startTime && c.endTime
                  ? `${WEEKDAY[c.weekday]} · ${formatTimeRange(c.startTime, c.endTime)}`
                  : "-";
              const where = c.location ?? (c.onlineLink ? "Online" : "-");
              return (
                <article key={c.id} className="panel flex flex-col gap-3.5 p-4">
                  <div className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] text-[15px] font-extrabold"
                      style={{ backgroundColor: tone.bg, color: tone.fg }}
                    >
                      {name.replace(/^VCE\s+/i, "").charAt(0).toUpperCase()}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <h3 className="text-[15px] font-extrabold text-ink">{name}</h3>
                      {week && (
                        <span className="text-[12px] text-muted">
                          Week {week.weekNumber} · {week.title}
                        </span>
                      )}
                    </span>
                  </div>
                  <dl className="grid grid-cols-[64px_1fr] gap-y-1.5 text-[13px]">
                    <dt className="font-semibold text-muted">When</dt>
                    <dd className="font-bold text-ink tabular-nums">{when}</dd>
                    <dt className="font-semibold text-muted">Where</dt>
                    <dd className="truncate font-bold text-ink">{where}</dd>
                    <dt className="font-semibold text-muted">Enrolled</dt>
                    <dd className="flex items-center gap-2">
                      <span
                        className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-[#F1F2F7]"
                        role="presentation"
                      >
                        <span
                          className={cn("block h-full rounded-[3px]", full ? "bg-warn" : "bg-ink")}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className={cn("font-bold tabular-nums", full ? "text-warn" : "text-ink")}>
                        {enrolled} / {capacity}
                      </span>
                    </dd>
                  </dl>
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Link href={`/tutor/classes/${c.id}/curriculum`} className={LINE_BUTTON}>
                      Week plan
                    </Link>
                    <Link href={`/tutor/classes/${c.id}/lessons`} className={LINE_BUTTON}>
                      Lessons
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
