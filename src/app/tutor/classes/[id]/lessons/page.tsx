import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, GlassPanel, Pill, buttonVariants } from "@/components/admin/ui";
import { requireTutor } from "@/app/tutor/_data";
import { ClassHero } from "../_components/class-hero";
import { formatTimeRange, parseLessonDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getClassHub,
  getClassLessonCounts,
  getTermDates,
  melbourneNow,
} from "../_lib/class-hub";
import {
  groupLessons,
  termWeekLabel,
  type LessonView,
} from "@/lib/lesson-progress";
import { LESSON_ACTION_LABEL } from "@/app/tutor/_lib/lessons-to-finish";

const DONE_PAGE = 10;

const dow = new Intl.DateTimeFormat("en-AU", { weekday: "short" });
const month = new Intl.DateTimeFormat("en-AU", { month: "short" });


export default async function TutorClassLessonsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const tutor = await requireTutor();
  const { id: classId } = await params;
  const hub = await getClassHub(tutor.id, classId);
  if (!hub) notFound();

  const { done: doneParam } = await searchParams;
  const doneLimit = Math.max(DONE_PAGE, Number(doneParam) || DONE_PAGE);

  const { today, nowTime } = melbourneNow();
  const [lessons, termList] = await Promise.all([
    getClassLessonCounts(tutor.id, classId),
    getTermDates(),
  ]);
  const groups = groupLessons(lessons, today, nowTime);
  const done = groups.done.slice(0, doneLimit);
  const weekOf = (date: string) =>
    termWeekLabel(date, termList, hub.termWeek?.termId ?? null);

  return (
    <>
      <ClassHero hub={hub} tutorId={tutor.id} />
      <LessonSection
        title="This week"
        rows={groups.thisWeek}
        today={today}
        weekOf={weekOf}
        empty="No lessons this week."
      />
      {groups.needsFinishing.length > 0 && (
        <LessonSection
          title="Needs finishing"
          rows={groups.needsFinishing}
          today={today}
          weekOf={weekOf}
        />
      )}
      <LessonSection
        title="Done"
        rows={done}
        today={today}
        weekOf={weekOf}
        empty="Finished lessons show here."
        footer={
          groups.done.length > done.length ? (
            <div className="border-t border-line p-2 text-center">
              <Link
                href={`/tutor/classes/${classId}/lessons?done=${doneLimit + DONE_PAGE}`}
                scroll={false}
                className={buttonVariants({ variant: "ghost", size: "md" })}
              >
                Show older lessons
              </Link>
            </div>
          ) : null
        }
      />
    </>
  );
}

function LessonSection({
  title,
  rows,
  today,
  weekOf,
  empty,
  footer,
}: {
  title: string;
  rows: LessonView[];
  today: string;
  weekOf: (date: string) => string | null;
  empty?: string;
  footer?: React.ReactNode;
}) {
  const id = `lessons-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <GlassPanel title={title} titleId={id}>
      {rows.length === 0 ? (
        <Empty className="py-8">{empty}</Empty>
      ) : (
        <>
          {/* Phones: one stacked card per lesson, nothing scrolls sideways. */}
          <ul className="divide-y divide-line sm:hidden">
            {rows.map((l) => (
              <LessonCard key={l.id} lesson={l} today={today} week={weekOf(l.date)} />
            ))}
          </ul>
          {/* Fixed layout so the columns line up across the three tables. */}
          <table className="hidden w-full table-fixed border-collapse text-[14px] sm:table">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th scope="col" className="w-[90px] px-4 py-2.5 font-extrabold">
                  Date
                </th>
                <th scope="col" className="w-[26%] px-3 py-2.5 font-extrabold">
                  Week
                </th>
                <th scope="col" className="w-[26%] px-3 py-2.5 font-extrabold">
                  Attendance
                </th>
                <th scope="col" className="px-3 py-2.5 font-extrabold">
                  Lesson notes
                </th>
                <th scope="col" className="w-[170px] px-4 py-2.5">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <LessonRow key={l.id} lesson={l} today={today} week={weekOf(l.date)} />
              ))}
            </tbody>
          </table>
          {footer}
        </>
      )}
    </GlassPanel>
  );
}

type RowProps = { lesson: LessonView; today: string; week: string | null };

function DateBlock({ lesson: l, today }: RowProps) {
  const date = parseLessonDate(l.date);
  const sameYearMonth = l.date.slice(0, 7) === today.slice(0, 7);
  return (
    <span className="flex flex-col leading-[1.15]">
      <span className="text-[11px] font-extrabold uppercase text-muted">
        {dow.format(date)}
      </span>
      <span className="text-[16px] font-extrabold tabular-nums">
        {date.getDate()}
        {!sameYearMonth && (
          <span className="ml-1 text-[12px] font-bold text-muted">
            {month.format(date)}
          </span>
        )}
      </span>
    </span>
  );
}

function WeekBlock({ lesson: l, week }: RowProps) {
  return (
    <span className="flex flex-col">
      {week && <span className="font-bold">{week}</span>}
      <span className={cn("tabular-nums", week ? "text-[12px] text-muted" : "font-bold")}>
        {formatTimeRange(l.startTime, l.endTime)}
        {l.isToday && " · today"}
      </span>
    </span>
  );
}

function ActionLink({ lesson: l, className }: { lesson: LessonView; className?: string }) {
  return (
    <Link
      href={`/tutor/lessons/${l.id}?from=class`}
      className={buttonVariants({
        variant: l.action !== "view" ? "primary" : "outline",
        size: "sm",
        className,
      })}
    >
      {LESSON_ACTION_LABEL[l.action]}
    </Link>
  );
}

function LessonRow(props: RowProps) {
  const l = props.lesson;
  return (
    <tr
      className={cn(
        "border-t border-line transition-colors hover:bg-surface-2",
        !l.started && !l.isToday && "text-ink/70",
      )}
    >
      <td className="px-4 py-3">
        <DateBlock {...props} />
      </td>
      <td className="px-3 py-3">
        <WeekBlock {...props} />
      </td>
      <td className="px-3 py-3">
        <Pill tone={l.attendanceTone}>{l.attendanceLabel}</Pill>
      </td>
      <td className="px-3 py-3">
        <Pill tone={l.notesTone}>{l.notesLabel}</Pill>
      </td>
      <td className="px-4 py-3 text-right">
        <ActionLink lesson={l} />
      </td>
    </tr>
  );
}

function LessonCard(props: RowProps) {
  const l = props.lesson;
  return (
    <li
      className={cn(
        "flex flex-col gap-2.5 px-4 py-3 text-[14px]",
        !l.started && !l.isToday && "text-ink/70",
      )}
    >
      <div className="flex items-center gap-4">
        <span className="w-[52px] shrink-0">
          <DateBlock {...props} />
        </span>
        <span className="min-w-0 flex-1">
          <WeekBlock {...props} />
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-[68px]">
        <Pill tone={l.attendanceTone}>{l.attendanceLabel}</Pill>
        <Pill tone={l.notesTone}>Notes: {l.notesLabel.toLowerCase()}</Pill>
      </div>
      <div className="pl-[68px]">
        <ActionLink lesson={l} className="h-10 w-full" />
      </div>
    </li>
  );
}
