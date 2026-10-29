import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Pill, TabLinks, buttonVariants } from "@/components/admin/ui";
import { HomeworkList } from "@/components/student-history/homework-list";
import { KeyNumbers } from "@/components/student-history/key-numbers";
import { LessonTimeline, type TimelineAction } from "@/components/student-history/lesson-timeline";
import { ProfileSection } from "@/components/ui/profile-section";
import { formatDateLong, formatDateShort } from "@/lib/format";
import { RECENT_LESSONS, type HistoryTone, type LessonTimelineEntry } from "@/lib/student-history";
import type { RecordNote } from "@/lib/student-record";
import { cn } from "@/lib/utils";
import { getStudentProfile, requireTutor } from "../../_data";
import { getStudentHeaderContext } from "../_lib/student-data";
import { profileBack, withListQuery } from "../_lib/student-list";
import { StudentAvatar } from "../_components/student-avatar";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "lessons", label: "Lessons" },
  { key: "homework", label: "Homework" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/** The Attendance and Lesson notes tabs became the one Lessons timeline. */
const TAB_ALIASES: Record<string, Tab> = { attendance: "lessons", notes: "lessons" };

function parseTab(value: string | undefined): Tab {
  if (!value) return "overview";
  if (TAB_ALIASES[value]) return TAB_ALIASES[value];
  return TABS.some((t) => t.key === value) ? (value as Tab) : "overview";
}

/** Last lessons tiles, coloured by the timeline's tone. */
const TILE_TONE: Record<HistoryTone, string> = {
  good: "bg-good-bg text-good",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  info: "bg-info-bg text-info",
  default: "bg-surface-3 text-ink-soft",
};

/**
 * A student's profile, opened from a class's Students roster, Marking,
 * lessons, Today, discussions or messages (`profileBack` reads where from):
 * the header, then their record in three tabs, the Overview opening with
 * the key numbers inside the panel (owner, 29 October 2026). The record and
 * its parts are the same as on the admin's History tab (`getStudentRecord`,
 * `src/components/student-history`), limited to this tutor's classes;
 * getStudentProfile runs assertTutorTeachesStudent first and 404s for
 * anyone else's student.
 */
export default async function TutorStudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    class?: string;
    from?: string;
    homework?: string;
    lesson?: string;
    view?: string;
  }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab = parseTab(sp.tab);

  const tutor = await requireTutor();
  const { student, record } = await getStudentProfile(tutor.id, id);
  const context = await getStudentHeaderContext(tutor.id, id);

  const name = `${student.firstName} ${student.lastName}`.trim();

  const parentLabel =
    context.parents.length === 0
      ? null
      : `${context.parents.length === 1 ? "Parent" : "Parents"}: ${context.parents
          .map((p) => p.name)
          .join(", ")}`;
  const subParts = [student.email, ...context.classNames, parentLabel].filter(
    (part): part is string => !!part,
  );
  const primaryParent = context.parents[0] ?? null;

  const basePath = `/tutor/students/${id}`;
  const back = profileBack(id, sp);
  const homeworkHref = (row: { homeworkId: string }) =>
    `/tutor/homework/${row.homeworkId}?student=${student.id}`;

  const panels: Record<Tab, ReactNode> = {
    // Flat sections with hairline dividers, as on the admin's History tab.
    overview: (
      <div className="divide-y divide-line">
        <KeyNumbers items={record.keyNumbers} />
        <ProfileSection title="Last lessons">
          <RecentLessons entries={record.timeline.slice(0, RECENT_LESSONS)} />
        </ProfileSection>
        <ProfileSection title="Homework" flush>
          <HomeworkList
            rows={record.homework.slice(0, 3)}
            rowHref={homeworkHref}
            className="border-t border-line"
          />
        </ProfileSection>
      </div>
    ),
    lessons: (
      <LessonTimeline
        entries={record.timeline}
        viewer={{ kind: "tutor", id: tutor.id }}
        action={(entry) => lessonAction(entry, tutor.id, student.id)}
      />
    ),
    homework: <HomeworkList rows={record.homework} rowHref={homeworkHref} />,
  };

  return (
    <section
      aria-labelledby="student-profile-name"
      className="glass flex min-w-0 flex-col gap-1.5 rounded-[24px] p-1.5"
    >
      <div className="flex flex-wrap items-center gap-3.5 px-2.5 pb-2 pt-2.5 sm:pl-3.5">
        <Link
          href={back.href}
          aria-label={back.label}
          title={back.label}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/95 bg-white/65 text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
        </Link>
        <StudentAvatar name={name} avatarKey={student.profileAvatarKey} size={52} />
        <div className="flex min-w-0 flex-1 basis-[240px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              id="student-profile-name"
              className="text-[20px] font-extrabold leading-tight text-ink"
            >
              {name}
            </h1>
            {student.yearLevel && (
              <span className="inline-flex h-[22px] items-center rounded-full bg-white px-[9px] text-[11px] font-extrabold uppercase text-ink">
                {/^\d+$/.test(student.yearLevel.trim())
                  ? `Year ${student.yearLevel.trim()}`
                  : student.yearLevel}
              </span>
            )}
            {context.leave && (
              <span
                title={`${formatDateLong(context.leave.startDate)} - ${formatDateLong(context.leave.endDate)}`}
              >
                <Pill tone="info">On leave</Pill>
              </span>
            )}
            {context.trial && (
              <span
                title={`Free trial: ${formatDateLong(context.trial.startDate)} - ${formatDateLong(context.trial.endDate)}`}
              >
                <Pill tone="good">Free trial</Pill>
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold text-ink-soft [overflow-wrap:anywhere]">
            {subParts.join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Link
            href={`/tutor/messages/with/${student.id}`}
            className={cn(buttonVariants({ variant: "glass", size: "md" }), "h-[38px] rounded-[11px]")}
          >
            Message student
          </Link>
          {primaryParent && (
            <Link
              href={`/tutor/messages/with/${primaryParent.id}`}
              className={cn(buttonVariants({ variant: "glass", size: "md" }), "h-[38px] rounded-[11px]")}
            >
              Message parent
              {context.parents.length > 1 && (
                <span className="sr-only"> {primaryParent.name}</span>
              )}
            </Link>
          )}
        </div>
      </div>

      <div className="panel min-w-0 overflow-hidden">
        <TabLinks
          label="Student sections"
          items={TABS.map((t) => ({
            label: t.label,
            // Overview is the default tab, so it gets the clean URL.
            href: withListQuery(basePath, sp, t.key === "overview" ? undefined : { tab: t.key }),
            active: t.key === tab,
          }))}
        />
        {panels[tab]}
      </div>
    </section>
  );
}

/**
 * The tutor's button on a lesson they teach: mark the roll, or add or edit
 * their note. A lesson they did not teach, or that Taiyo cancelled, has none.
 */
function lessonAction(
  entry: LessonTimelineEntry<RecordNote>,
  tutorId: string,
  studentId: string,
): TimelineAction | null {
  if (entry.tutorId !== tutorId || entry.cancelled) return null;
  const label =
    entry.status === null
      ? "Mark attendance"
      : entry.notes.some((note) => note.authorId === tutorId)
        ? "Edit note"
        : entry.status === "absent"
          ? null
          : "Add note";
  return label ? { href: `/tutor/lessons/${entry.lessonId}?from=student&student=${studentId}`, label } : null;
}

/** The last few lessons as tiles, oldest on the left. */
function RecentLessons({ entries }: { entries: LessonTimelineEntry<RecordNote>[] }) {
  if (entries.length === 0) {
    return <p className="text-[13px] text-muted">No lessons yet.</p>;
  }
  return (
    <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
      {[...entries].reverse().map((entry) => (
        <li
          key={entry.lessonId}
          title={`${formatDateShort(entry.date)} · ${entry.className} · ${entry.label}`}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-[10px] px-1 py-2 text-center",
            TILE_TONE[entry.tone],
          )}
        >
          <span className="text-[11px] font-extrabold tabular-nums">{formatDateShort(entry.date)}</span>
          <span className="text-[10px] font-extrabold uppercase leading-tight">{entry.label}</span>
        </li>
      ))}
    </ol>
  );
}
