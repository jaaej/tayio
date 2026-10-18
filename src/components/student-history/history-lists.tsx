import Link from "next/link";
import { Empty, Pill } from "@/components/admin/ui";
import { formatDateShort, formatScore, formatWeekday } from "@/lib/format";
import {
  STAFF_NOTE_LABEL,
  type AttendanceHistoryRow,
  type HomeworkHistoryRow,
  type StaffNote,
} from "@/lib/student-history";

/*
 * A student's history for staff, as three lists built from
 * `@/lib/student-history`: lessons with their attendance, homework with
 * its state, and the staff-notes timeline. Rows follow the tutor student
 * profile's attendance and homework rows.
 */

const ROW = "flex min-h-12 items-center gap-3 px-4 py-2.5 sm:px-5";
const DATE = "w-24 shrink-0 text-[12px] font-semibold tabular-nums text-muted";

function day(isoDate: string) {
  return `${formatWeekday(isoDate, "short")} ${formatDateShort(isoDate)}`;
}

/** Every lesson that ran, newest first; `lessonHref` opens its roll. */
export function AttendanceHistoryList({
  rows,
  lessonHref,
}: {
  rows: AttendanceHistoryRow[];
  lessonHref?: (lessonId: string) => string;
}) {
  if (rows.length === 0) return <Empty>No lessons yet.</Empty>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((row) => {
        // On a phone the date moves under the class name, leaving the
        // class its full width.
        const body = (
          <>
            <span className={`${DATE} hidden sm:block`}>{day(row.date)}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-bold text-ink">{row.className}</span>
              <span className="text-[12px] tabular-nums text-muted sm:hidden">{day(row.date)}</span>
            </span>
            <Pill tone={row.tone} className="shrink-0">
              {row.label}
            </Pill>
          </>
        );
        return (
          <li key={row.lessonId}>
            {lessonHref ? (
              <Link
                href={lessonHref(row.lessonId)}
                className={`${ROW} transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400`}
              >
                {body}
              </Link>
            ) : (
              <div className={ROW}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Every homework task, latest due first. */
export function HomeworkHistoryList({ rows }: { rows: HomeworkHistoryRow[] }) {
  if (rows.length === 0) return <Empty>No homework assigned yet.</Empty>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <li key={row.homeworkId} className={ROW}>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-bold text-ink">{row.title}</span>
            <span className="truncate text-[12px] text-muted">
              Due {day(row.dueDate)}
              {row.className && ` · ${row.className}`}
            </span>
          </span>
          {row.score !== null && row.state === "marked" && (
            <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-ink">
              {formatScore(row.score)}
              <span className="sr-only"> score</span>
            </span>
          )}
          <Pill tone={row.tone} className="shrink-0">
            {row.label}
          </Pill>
        </li>
      ))}
    </ul>
  );
}

/**
 * Staff notes in one dated list: the account note (undated, so first), then
 * lesson notes' internal part, roll notes, leave and free-trial notes.
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
    <ol className="divide-y divide-line border-y border-line">
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
