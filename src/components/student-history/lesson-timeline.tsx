import Link from "next/link";
import { Empty, Pill, buttonVariants } from "@/components/admin/ui";
import { LessonNoteCard, type NoteViewer } from "@/components/lessons/lesson-note-card";
import { formatDateShort, formatWeekday } from "@/lib/format";
import type { LessonTimelineEntry } from "@/lib/student-history";
import type { RecordNote } from "@/lib/student-record";
import { cn } from "@/lib/utils";
import { ShowAll } from "./show-all";

export type TimelineAction = { href: string; label: string };

/**
 * A student's lessons, newest first (`lessonTimeline`): when, which class,
 * how they were marked (with the roll note), and every note written on it
 * under the editor's two visibility labels and its author. Shared by the
 * tutor's Lessons tab and the admin's History tab; `action` is the role's
 * button on a lesson ("Edit note", "Open roll"). With `limit`, older lessons
 * open in place behind "Show all".
 */
export function LessonTimeline({
  entries,
  viewer,
  action,
  limit,
  className,
}: {
  entries: LessonTimelineEntry<RecordNote>[];
  viewer: NoteViewer;
  action: (entry: LessonTimelineEntry<RecordNote>) => TimelineAction | null;
  limit?: number;
  className?: string;
}) {
  if (entries.length === 0) return <Empty>No lessons yet.</Empty>;
  const shown = limit ? entries.slice(0, limit) : entries;
  const rest = limit ? entries.slice(limit) : [];
  const item = (entry: LessonTimelineEntry<RecordNote>) => (
    <TimelineEntry key={entry.lessonId} entry={entry} viewer={viewer} action={action(entry)} />
  );
  return (
    <div className={className}>
      <div className="divide-y divide-line">{shown.map(item)}</div>
      {rest.length > 0 && (
        <ShowAll total={entries.length} noun="lessons">
          <div className="divide-y divide-line">{rest.map(item)}</div>
        </ShowAll>
      )}
    </div>
  );
}

function TimelineEntry({
  entry,
  viewer,
  action,
}: {
  entry: LessonTimelineEntry<RecordNote>;
  viewer: NoteViewer;
  action: TimelineAction | null;
}) {
  // Only a lesson they sat expects a note.
  const expectsNote = entry.status !== null && entry.status !== "absent" && !entry.cancelled;
  return (
    <article className="flex flex-col gap-2.5 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="w-[84px] shrink-0 text-[12px] font-semibold tabular-nums text-muted">
          {formatWeekday(entry.date, "short")} {formatDateShort(entry.date)}
        </span>
        <span className="min-w-0 flex-1 basis-[160px] text-[13px] font-bold text-ink">
          {entry.className}
        </span>
        <Pill tone={entry.tone}>{entry.label}</Pill>
        {action && (
          <Link
            href={action.href}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-[10px]")}
          >
            {action.label}
          </Link>
        )}
      </div>
      {entry.rollNote && (
        <p className="text-[13px] leading-normal text-ink-soft sm:pl-[96px]">
          <span className="font-bold text-ink">Attendance note:</span> {entry.rollNote}
        </p>
      )}
      {entry.notes.map((note) => (
        <LessonNoteCard key={note.id} note={note} viewer={viewer} className="sm:pl-[96px]" />
      ))}
      {entry.notes.length === 0 && expectsNote && (
        <p className="text-[13px] text-muted sm:pl-[96px]">No note written.</p>
      )}
    </article>
  );
}
