import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Empty,
  Pill,
  TabLinks,
  buttonVariants,
  type PillTone,
} from "@/components/admin/ui";
import { ProfileSection } from "@/components/ui/profile-section";
import { attendanceLabel, isMovedAbsence } from "@/lib/attendance-rules";
import { formatDateLong, formatDateShort, formatWeekday, formatScore } from "@/lib/format";
import { NOTE_VISIBILITY, sharedNoteFields } from "@/lib/lesson-note-fields";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { cn } from "@/lib/utils";
import { getStudentProfile, requireTutor } from "../../_data";
import { getStudentHeaderContext } from "../_lib/student-data";
import {
  HOMEWORK_STATE,
  RECENT_LESSONS,
  homeworkState,
  lessonTimeline,
  profileBack,
  withListQuery,
  type LessonTimelineEntry,
} from "../_lib/student-list";
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

const MOVED_TONE = "bg-surface-3 text-ink-soft";

const ATTENDANCE_TONE: Record<string, string> = {
  present: "bg-good-bg text-good",
  late: "bg-warn-bg text-warn",
  left_early: "bg-warn-bg text-warn",
  absent: "bg-bad-bg text-bad",
  makeup_attended: "bg-info-bg text-info",
};

const ATTENDANCE_PILL: Record<string, PillTone> = {
  present: "good",
  late: "warn",
  left_early: "warn",
  absent: "bad",
  makeup_attended: "info",
};

type Profile = Awaited<ReturnType<typeof getStudentProfile>>;

/**
 * A student's profile, opened from a class's Students roster, Marking,
 * lessons, Today, discussions or messages (`profileBack` reads where from):
 * the header, then their attendance, homework and lesson notes as tabs, with
 * no quick-fact tiles (the owner removed them on 29 October 2026, as on the
 * admin student profile). Everything is limited to the classes,
 * homework and notes of this tutor (getStudentProfile runs
 * assertTutorTeachesStudent first and 404s for anyone else's student).
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
  const profile = await getStudentProfile(tutor.id, id);
  const context = await getStudentHeaderContext(tutor.id, id);
  const { student, attendance, notes, homework } = profile;
  const { today } = context;

  const name = `${student.firstName} ${student.lastName}`.trim();
  const timeline = lessonTimeline(
    attendance,
    notes.map((n) => ({ ...n, note: { ...n, mine: n.authorId === tutor.id } })),
    tutor.id,
  );
  const recent = attendance.slice(0, RECENT_LESSONS);

  const homeworkRows = homework.map((h) => {
    const dueDate = melbourneDate(h.dueDate);
    return { ...h, dueDate, state: homeworkState(h.status, dueDate, today) };
  });

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

  const panels: Record<Tab, ReactNode> = {
    // Flat sections with hairline dividers, as on the admin student profile.
    overview: (
      <div className="divide-y divide-line">
        <ProfileSection title="Last lessons">
          <RecentLessons rows={recent} />
        </ProfileSection>
        <ProfileSection title="Homework" flush>
          <HomeworkList
            rows={homeworkRows.slice(0, 3)}
            studentId={student.id}
            className="border-t border-line"
          />
        </ProfileSection>
      </div>
    ),
    lessons: <LessonsTimeline entries={timeline} studentId={student.id} />,
    homework: <HomeworkList rows={homeworkRows} studentId={student.id} />,
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

/** The last few marked lessons as tiles, oldest on the left. */
function RecentLessons({ rows }: { rows: Profile["attendance"] }) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-muted">No attendance recorded yet.</p>;
  }
  return (
    <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
      {[...rows].reverse().map((a) => {
        const label = attendanceLabel(a);
        return (
          <li
            key={a.lessonId}
            title={`${formatDateShort(a.lessonDate)} · ${a.className} · ${label}`}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-[10px] px-1 py-2 text-center",
              isMovedAbsence(a) ? MOVED_TONE : (ATTENDANCE_TONE[a.status] ?? "bg-surface-3 text-ink"),
            )}
          >
            <span className="text-[11px] font-extrabold tabular-nums">
              {formatDateShort(a.lessonDate)}
            </span>
            <span className="text-[10px] font-extrabold uppercase leading-tight">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

type HomeworkRow = Omit<Profile["homework"][number], "dueDate"> & {
  dueDate: string;
  state: keyof typeof HOMEWORK_STATE;
};

/** Edge-to-edge rows split by hairlines, like the shared history lists. */
function HomeworkList({
  rows,
  studentId,
  className,
}: {
  rows: HomeworkRow[];
  studentId: string;
  className?: string;
}) {
  if (rows.length === 0) return <Empty>No homework assigned yet.</Empty>;
  return (
    <ul className={cn("divide-y divide-line", className)}>
      {rows.map((h) => {
        const state = HOMEWORK_STATE[h.state];
        return (
          <li key={h.homeworkId}>
            <Link
              href={`/tutor/homework/${h.homeworkId}?student=${studentId}`}
              className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 sm:px-5"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-bold">{h.title}</span>
                <span className="text-[12px] text-muted">
                  Due {formatWeekday(h.dueDate, "short")} {formatDateShort(h.dueDate)}
                </span>
              </span>
              {h.score !== null && (
                <span className="shrink-0 text-[13px] font-extrabold tabular-nums">
                  {formatScore(h.score)}
                  <span className="sr-only"> score</span>
                </span>
              )}
              <Pill tone={state.tone as PillTone} className="shrink-0">
                {state.label}
              </Pill>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function LessonsTimeline({
  entries,
  studentId,
}: {
  entries: LessonTimelineEntry<Note>[];
  studentId: string;
}) {
  if (entries.length === 0) return <Empty>No lessons recorded yet.</Empty>;
  return (
    <div className="divide-y divide-line">
      {entries.map((entry) => (
        <TimelineEntry key={entry.lessonId} entry={entry} studentId={studentId} />
      ))}
    </div>
  );
}

type Note = Profile["notes"][number] & { mine: boolean };

/**
 * One lesson: when, which class, how the student was marked (with the roll
 * note), every note written on it under the editor's two visibility labels
 * and its author, and a link to the lesson when this tutor teaches it.
 */
function TimelineEntry({
  entry,
  studentId,
}: {
  entry: LessonTimelineEntry<Note>;
  studentId: string;
}) {
  const mark = entry.mark;
  const absent = mark?.status === "absent";
  const action = entry.canEdit
    ? entry.hasOwnNote
      ? "Edit note"
      : absent
        ? null
        : "Add note"
    : null;
  return (
    <article className="flex flex-col gap-2.5 px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="w-[84px] shrink-0 text-[12px] font-semibold tabular-nums text-muted">
          {formatWeekday(entry.date, "short")} {formatDateShort(entry.date)}
        </span>
        <span className="min-w-0 flex-1 basis-[160px] text-[13px] font-bold text-ink">
          {entry.className}
        </span>
        {mark && (
          <Pill tone={isMovedAbsence(mark) ? "default" : (ATTENDANCE_PILL[mark.status] ?? "default")}>
            {attendanceLabel(mark)}
          </Pill>
        )}
        {action && (
          <Link
            href={`/tutor/lessons/${entry.lessonId}?from=student&student=${studentId}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-[10px]")}
          >
            {action}
          </Link>
        )}
      </div>
      {mark?.note?.trim() && (
        <p className="text-[13px] leading-normal text-ink-soft sm:pl-[96px]">
          <span className="font-bold text-ink">Attendance note:</span> {mark.note}
        </p>
      )}
      {entry.notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
      {entry.notes.length === 0 && mark && !absent && (
        <p className="text-[13px] text-muted sm:pl-[96px]">No note written.</p>
      )}
    </article>
  );
}

/** A note's fields under the same two labels the editor uses, then its author. */
function NoteCard({ note }: { note: Note }) {
  const shared = sharedNoteFields(note);
  const internal = note.internalNote?.trim() ?? "";
  const author = note.mine ? "you" : `${note.authorFirstName} ${note.authorLastName}`.trim();
  return (
    <div className="flex flex-col gap-2 sm:pl-[96px]">
      <div className="flex flex-wrap gap-2">
        {shared.length > 0 && (
          <div className="min-w-0 flex-[999_1_300px] rounded-[12px] bg-good-bg/60 p-3 text-[13px] leading-normal text-ink">
            <strong className="mb-1.5 block text-[12px] font-extrabold text-good">
              {NOTE_VISIBILITY.shared}
            </strong>
            <dl className="flex flex-col gap-1.5">
              {shared.map((field) => (
                <div key={field.key}>
                  <dt className="text-[12px] font-bold text-ink-soft">{field.label}</dt>
                  <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{field.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {internal && (
          <div className="min-w-0 flex-[1_1_200px] rounded-[12px] bg-warn-bg/60 p-3 text-[13px] leading-normal text-ink">
            <strong className="mb-1.5 block text-[12px] font-extrabold text-warn">
              {NOTE_VISIBILITY.internal}
            </strong>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{internal}</p>
          </div>
        )}
        {shared.length === 0 && !internal && (
          <p className="text-[13px] text-muted">The note is empty.</p>
        )}
      </div>
      <p className="text-[12px] text-muted">Written by {author}</p>
    </div>
  );
}
