import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SubjectDot, buttonVariants } from "@/components/admin/ui";
import { requireTutor } from "@/app/tutor/_data";
import { classDisplayName } from "@/lib/class-display";
import { WEEKDAY_LABELS } from "@/lib/class-move-rules";
import { formatTime, formatTimeRange } from "@/lib/format";
import { ClassTabs } from "./_components/class-tabs";
import {
  getChangesRequestedCount,
  getClassHub,
  getClassLessonCounts,
  melbourneNow,
} from "./_lib/class-hub";
import { needsFinishingCount } from "./_lib/lesson-progress";

/**
 * The class page: one glass header (class, schedule, today's lesson) and the
 * tab row, shared by Week plan, Lessons, Students and Announcements. Each tab
 * page re-checks ownership too, so a page never relies on the layout alone.
 */
export default async function TutorClassLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const tutor = await requireTutor();
  const { id: classId } = await params;
  const hub = await getClassHub(tutor.id, classId);
  if (!hub) notFound();

  const [lessons, changesRequested] = await Promise.all([
    getClassLessonCounts(tutor.id, classId),
    getChangesRequestedCount(classId),
  ]);
  const { today, nowTime } = melbourneNow();
  const todays = lessons.find(
    (l) =>
      l.date === today && l.status !== "cancelled" && l.status !== "rescheduled",
  );

  const facts = [
    typeof hub.weekday === "number" && WEEKDAY_LABELS[hub.weekday]
      ? `${WEEKDAY_LABELS[hub.weekday]}s`
      : null,
    hub.startTime && hub.endTime
      ? formatTimeRange(hub.startTime, hub.endTime)
      : null,
    hub.location?.trim() || null,
    `${hub.rosterCount} ${hub.rosterCount === 1 ? "student" : "students"}`,
    hub.termWeek
      ? `Term ${hub.termWeek.termNumber}, Week ${hub.termWeek.weekNumber}`
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <header className="glass flex flex-col gap-3 rounded-[24px] px-3.5 pb-2.5 pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <Link
              href="/tutor/classes"
              aria-label="All classes"
              title="All classes"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/95 bg-white/65 text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
            </Link>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="flex min-w-0 items-center gap-2 text-[22px] font-extrabold leading-tight text-ink">
                <SubjectDot subject={hub.subjectName} className="h-[11px] w-[11px] rounded-[4px]" />
                <span className="min-w-0 break-words">
                  {classDisplayName(hub.subjectName, hub.name)}
                </span>
              </h1>
              <p className="text-[13px] font-semibold text-ink-soft">
                {facts.join(" · ")}
              </p>
            </div>
          </div>
          {todays && (
            <Link
              href={`/tutor/lessons/${todays.id}`}
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              Today {formatTime(todays.startTime)}
              <span aria-hidden className="opacity-70">
                ·
              </span>
              Open lesson
            </Link>
          )}
        </div>
        <ClassTabs
          classId={classId}
          lessonsToFinish={needsFinishingCount(lessons, today, nowTime)}
          rosterCount={hub.rosterCount}
          changesRequested={changesRequested}
        />
      </header>
      {children}
    </div>
  );
}
