"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, NotebookPen } from "lucide-react";
import { Avatar, Button, Empty, Pill, buttonVariants } from "@/components/admin/ui";
import { ActionSpinner } from "@/components/ui/loading-button";
import { adminSaveAttendance } from "@/app/admin/_lib/actions-attendance";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "present", label: "Present", tone: "text-good" },
  { value: "late", label: "Late", tone: "text-warn" },
  { value: "left_early", label: "Left early", tone: "text-warn" },
  { value: "absent", label: "Absent", tone: "text-bad" },
  { value: "makeup_attended", label: "Make-up", tone: "text-info" },
] as const;

type Status = (typeof OPTIONS)[number]["value"];

export type MarkingStudent = {
  id: string;
  name: string;
  status: Status | null;
  note: string;
  onTrial: boolean;
  /** Set when the student moved out of this lesson: where they went. */
  movedOutTo?: string;
  /** Set when the student is here as a make-up: where they came from. */
  makeupFrom?: string;
};

/**
 * The marking half of the attendance split view. Owns the roll as client state
 * so "All present" and the live tally work before saving; the form still posts
 * the same `status[id]` / `note[id]` fields the server action validates.
 */
export function MarkingPane({
  lessonId,
  title,
  sub,
  students,
  backHref,
  nextHref,
  notesButton,
}: {
  lessonId: string;
  title: string;
  sub: string;
  students: MarkingStudent[];
  /** The queue, with its filters; also where saving the last lesson lands. */
  backHref: string;
  /** The next lesson in the queue, or null when this is the last one. */
  nextHref: string | null;
  notesButton: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, Status | null>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.status])),
  );
  const headingId = useId();

  // Students who moved to another lesson keep the absence written when they
  // were moved; "All present" only fills in the class that is actually here.
  const markable = students.filter((s) => !s.movedOutTo && !s.makeupFrom);

  function allPresent() {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const s of markable) next[s.id] = "present";
      return next;
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await adminSaveAttendance(formData);
      } catch {
        setError("Attendance could not be saved. Check the roll and try again.");
        return;
      }
      router.push(nextHref ?? backHref);
    });
  }

  const tally = OPTIONS.map((opt) => ({
    label: opt.label.toLowerCase(),
    count: students.filter((s) => statuses[s.id] === opt.value).length,
  })).filter((t) => t.count > 0);
  const unmarked = students.filter((s) => !statuses[s.id]).length;

  return (
    <section
      aria-labelledby={headingId}
      className="glass flex min-w-0 flex-1 flex-col rounded-[24px] p-1.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 pl-2 pr-2.5 sm:pl-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            aria-label="Back to lessons"
            title="Back to lessons"
            className={cn(buttonVariants({ variant: "glass", size: "icon" }), "h-10 w-10 shrink-0 rounded-[12px] xl:hidden")}
          >
            <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
          </Link>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 id={headingId} className="text-[20px] font-extrabold leading-tight text-ink">
              {title}
            </h1>
            <p className="text-[13px] font-semibold text-ink-soft">{sub}</p>
          </div>
        </div>
        {markable.length > 0 && (
          <Button
            type="button"
            variant="glass"
            className="h-[38px] rounded-[11px] px-3"
            onClick={allPresent}
          >
            All present
          </Button>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="panel flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        <input type="hidden" name="lessonId" value={lessonId} />
        {students.length === 0 ? (
          <Empty>No students enrolled in this class.</Empty>
        ) : (
          <ul>
            {students.map((s) => (
              <StudentRow
                key={s.id}
                student={s}
                status={statuses[s.id] ?? null}
                onChange={(status) =>
                  setStatuses((prev) => ({ ...prev, [s.id]: status }))
                }
              />
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFBFD] px-4 py-3.5">
          <p className="text-[13px] font-semibold text-ink-soft" aria-live="polite">
            {[
              ...tally.map((t) => `${t.count} ${t.label}`),
              ...(unmarked > 0 ? [`${unmarked} not marked`] : []),
            ].join(" · ")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {notesButton}
            <Button
              type="submit"
              disabled={pending || students.length === 0}
              aria-busy={pending || undefined}
              className="h-10 rounded-[11px] px-[18px] text-[14px]"
            >
              {pending && <ActionSpinner />}
              {nextHref ? "Save & next lesson" : "Save & finish"}
              {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
          {error && (
            <p role="alert" className="w-full text-right text-[12px] font-semibold text-bad">
              {error}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

function StudentRow({
  student,
  status,
  onChange,
}: {
  student: MarkingStudent;
  status: Status | null;
  onChange: (status: Status) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(student.note);
  const noteId = useId();
  const hasNote = note.trim().length > 0;

  return (
    <li className="border-b border-line px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <Avatar name={student.name} size={34} tone="brand" />
        <div className="flex min-w-0 flex-[1_1_140px] flex-col gap-1">
          <span className="text-[14px] font-bold text-ink">{student.name}</span>
          {(student.onTrial || student.movedOutTo || student.makeupFrom) && (
            <span className="flex flex-wrap gap-1.5">
              {student.onTrial && <Pill tone="info">Free trial</Pill>}
              {student.movedOutTo && (
                <Pill tone="warn">Rescheduled → {student.movedOutTo}</Pill>
              )}
              {student.makeupFrom && (
                <Pill tone="mint">Make-up ← {student.makeupFrom}</Pill>
              )}
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
        <div
          role="radiogroup"
          aria-label={`Attendance for ${student.name}`}
          className="flex w-full gap-0.5 rounded-[12px] bg-[#F1F2F7] p-[3px] sm:w-auto"
        >
          {OPTIONS.map((opt) => {
            const checked = status === opt.value;
            return (
              <label key={opt.value} className="flex flex-1 cursor-pointer sm:flex-none">
                <input
                  type="radio"
                  name={`status[${student.id}]`}
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
      </div>
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
