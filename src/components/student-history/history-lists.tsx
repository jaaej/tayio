import { Empty } from "@/components/admin/ui";
import { formatDateShort, formatWeekday } from "@/lib/format";
import { STAFF_NOTE_LABEL, type StaffNote } from "@/lib/student-history";

function day(isoDate: string) {
  return `${formatWeekday(isoDate, "short")} ${formatDateShort(isoDate)}`;
}

/**
 * The admin's staff notes that belong to no lesson, in one dated list: the
 * account note (undated, so first), then leave and free-trial notes. Lesson
 * and roll notes sit on their lesson in the timeline.
 */
export function StaffNotesTimeline({
  accountNote,
  notes,
}: {
  accountNote: string | null;
  notes: StaffNote[];
}) {
  if (!accountNote && notes.length === 0) return <Empty>No staff notes yet.</Empty>;
  return (
    <ol className="divide-y divide-line border-t border-line">
      {accountNote && (
        <li className="flex flex-col gap-1 px-4 py-3 sm:px-5">
          <span className="text-[12px] font-extrabold text-ink">Account note</span>
          <p className="whitespace-pre-wrap text-[13px] leading-normal text-ink-soft">{accountNote}</p>
        </li>
      )}
      {notes.map((note) => (
        <li key={note.key} className="flex flex-col gap-1 px-4 py-3 sm:px-5">
          <span className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
            <span className="font-semibold tabular-nums text-muted">{day(note.date)}</span>
            <span className="font-extrabold text-ink">{STAFF_NOTE_LABEL[note.kind]}</span>
            <span className="min-w-0 truncate text-muted">{note.source}</span>
          </span>
          <p className="whitespace-pre-wrap text-[13px] leading-normal text-ink-soft">{note.text}</p>
        </li>
      ))}
    </ol>
  );
}
