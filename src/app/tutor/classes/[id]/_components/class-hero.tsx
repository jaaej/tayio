import Link from "next/link";
import { HERO_ACTION, SubjectHero } from "@/components/subjects/subject-hero";
import { classDisplayName } from "@/lib/class-display";
import { WEEKDAY_LABELS } from "@/lib/class-move-rules";
import { formatTime, formatTimeRange } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import {
  getChangesRequestedCount,
  getClassLessonCounts,
  melbourneNow,
  type ClassHub,
} from "../_lib/class-hub";
import { needsFinishingCount } from "../_lib/lesson-progress";
import { ClassTabs } from "./class-tabs";

/**
 * The class page's hero in the subject colour, the same hero as the student
 * and admin curriculum pages: back to Classes and the class's tabs, then the
 * title and today's "Open lesson". Each tab renders it, so Week plan can
 * title it with the open week; the other tabs title it with the class and
 * put the schedule above.
 */
export async function ClassHero({
  hub,
  tutorId,
  title,
  kicker,
}: {
  hub: ClassHub;
  tutorId: string;
  /** Defaults to the class name. */
  title?: string;
  /** Defaults to the schedule ("Saturdays · 10:00 - 11:30 am · Room 3 · ..."). */
  kicker?: string;
}) {
  const [lessons, changesRequested] = await Promise.all([
    getClassLessonCounts(tutorId, hub.id),
    getChangesRequestedCount(hub.id),
  ]);
  const { today, nowTime } = melbourneNow();
  const todays = lessons.find(
    (l) =>
      l.date === today && l.status !== "cancelled" && l.status !== "rescheduled",
  );
  const fg = subjectTone(hub.subjectName, hub.subjectColor).fg;

  return (
    <SubjectHero
      subjectName={hub.subjectName}
      subjectColor={hub.subjectColor}
      nav={
        <ClassTabs
          classId={hub.id}
          lessonsToFinish={needsFinishingCount(lessons, today, nowTime)}
          rosterCount={hub.rosterCount}
          changesRequested={changesRequested}
          fg={fg}
        />
      }
      kicker={kicker ?? classSchedule(hub)}
      title={title ?? classDisplayName(hub.subjectName, hub.name)}
      actions={
        todays && (
          <Link
            href={`/tutor/lessons/${todays.id}`}
            className={`${HERO_ACTION} gap-1.5`}
            style={{ color: fg }}
          >
            Today {formatTime(todays.startTime)}
            <span aria-hidden className="opacity-60">
              ·
            </span>
            Open lesson
          </Link>
        )
      }
    />
  );
}

function classSchedule(hub: ClassHub): string {
  return [
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
  ]
    .filter(Boolean)
    .join(" · ");
}
