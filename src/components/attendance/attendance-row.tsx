"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { Avatar, Pill } from "@/components/admin/ui";
import { ATTENDANCE_OPTIONS, type AttendanceStatus } from "@/lib/attendance-roll";
import { cn } from "@/lib/utils";

export type RollStudent = {
  id: string;
  name: string;
  status: AttendanceStatus | null;
  note: string;
  onTrial: boolean;
  /** Set when the student moved out of this lesson: where they went. */
  movedOutTo?: string;
  /** The student cancelled this lesson for a class credit. */
  tookCredit?: boolean;
  /** Why the student moved or cancelled, from the move's own record. */
  moveReason?: string;
  /** Set when the student is here as a make-up: where they came from. */
  makeupFrom?: string;
  /** Profile link for the name, when the viewer may open it. */
  href?: string;
  /** Short muted detail after the name (a year level). */
  detail?: string | null;
  onLeave?: boolean;
  /** Free-trial context for the tutor, shown under the row. */
  trialNote?: string | null;
};

/**
 * One student on an attendance roll: avatar, name and flags, the segmented
 * status control and a note toggle. Shared by admin Attendance and the tutor
 * lesson page; the radios post `status[id]` / `note[id]`, which both roles'
 * save actions read.
 */
export function AttendanceRow({
  student,
  status,
  onChange,
}: {
  student: RollStudent;
  status: AttendanceStatus | null;
  onChange: (status: AttendanceStatus) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(student.note);
  const noteId = useId();
  const hasNote = note.trim().length > 0;
  const hasTags =
    student.onLeave || student.onTrial || student.movedOutTo || student.tookCredit || student.makeupFrom;

  return (
    <li className="border-b border-line px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <Avatar name={student.name} size={34} tone="brand" />
        <div className="flex min-w-0 flex-[1_1_140px] flex-col gap-1">
          <span className="flex min-w-0 items-baseline gap-2">
            {student.href ? (
              <Link
                href={student.href}
                className="truncate rounded-[4px] text-[14px] font-bold text-ink hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                {student.name}
              </Link>
            ) : (
              <span className="truncate text-[14px] font-bold text-ink">{student.name}</span>
            )}
            {student.detail && (
              <span className="shrink-0 text-[12px] text-muted">{student.detail}</span>
            )}
          </span>
          {hasTags && (
            <span className="flex min-w-0 flex-wrap gap-1.5">
              {student.onLeave && <Pill tone="warn">On leave</Pill>}
              {student.onTrial && <Pill tone="info">Free trial</Pill>}
              {/* A lesson label can be long: the pill stays one line and
                  shortens, with the whole label on hover. */}
              {student.movedOutTo && (
                <span title={`Rescheduled → ${student.movedOutTo}`} className="flex min-w-0 max-w-full">
                  <Pill tone="warn" className="min-w-0 max-w-full">
                    <span className="truncate">Rescheduled → {student.movedOutTo}</span>
                  </Pill>
                </span>
              )}
              {student.tookCredit && <Pill tone="warn">Cancelled for a credit</Pill>}
              {student.makeupFrom && (
                <span title={`Make-up ← ${student.makeupFrom}`} className="flex min-w-0 max-w-full">
                  <Pill tone="mint" className="min-w-0 max-w-full">
                    <span className="truncate">Make-up ← {student.makeupFrom}</span>
                  </Pill>
                </span>
              )}
            </span>
          )}
          {student.moveReason && (
            <span className="text-[12px] leading-snug text-ink-soft [overflow-wrap:anywhere]">
              <span className="font-bold text-ink">Reason:</span> {student.moveReason}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={`${hasNote ? "Edit" : "Add"} note for ${student.name}`}
          aria-expanded={noteOpen}
          aria-controls={noteId}
          onClick={() => setNoteOpen((open) => !open)}
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-ink-soft transition-colors sm:order-last",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
            hasNote ? "bg-warn-bg text-warn hover:brightness-95" : "hover:bg-surface-2",
          )}
        >
          <NotebookPen className="h-[15px] w-[15px]" aria-hidden />
        </button>
        <AttendanceSegmented
          name={`status[${student.id}]`}
          label={`Attendance for ${student.name}`}
          value={status}
          onChange={onChange}
        />
      </div>
      {student.trialNote && (
        <p className="mt-2.5 rounded-[10px] bg-info-bg px-3 py-2 text-[12px] leading-relaxed text-info sm:ml-[46px]">
          <span className="font-bold">Free-trial note:</span> {student.trialNote}
        </p>
      )}
      <div id={noteId} hidden={!noteOpen} className="mt-2.5 sm:pl-[46px]">
        <input
          name={`note[${student.id}]`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          aria-label={`Note for ${student.name}`}
          placeholder="Optional note (e.g. arrived 10 min late)"
          className={cn(
            "h-9 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[13px] text-ink",
            "placeholder:text-muted/80 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400/30",
          )}
        />
      </div>
    </li>
  );
}

/** The status control: real radios styled as a segmented track. */
function AttendanceSegmented({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-full gap-0.5 rounded-[12px] bg-[#F1F2F7] p-[3px] sm:w-auto"
    >
      {ATTENDANCE_OPTIONS.map((opt) => {
        const checked = value === opt.value;
        return (
          <label key={opt.value} className="flex flex-1 cursor-pointer sm:flex-none">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-8 w-full items-center justify-center whitespace-nowrap rounded-[9px] px-1 text-[11.5px] font-extrabold transition-colors duration-150 sm:px-3 sm:text-[12px]",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400",
                checked
                  ? cn("bg-surface shadow-[0_1px_3px_rgba(23,21,43,0.14)]", opt.tone)
                  : "text-muted hover:text-ink",
              )}
            >
              {opt.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
