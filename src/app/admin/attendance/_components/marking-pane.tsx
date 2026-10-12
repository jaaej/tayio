"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Button, Empty, buttonVariants } from "@/components/admin/ui";
import { AttendanceRow, type RollStudent } from "@/components/attendance/attendance-row";
import { ActionSpinner } from "@/components/ui/loading-button";
import { adminSaveAttendance } from "@/app/admin/_lib/actions-attendance";
import {
  canMarkAllPresent,
  markAllPresent,
  rollSummary,
  type RollStatuses,
} from "@/lib/attendance-roll";
import { cn } from "@/lib/utils";

export type MarkingStudent = RollStudent;

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
  const [statuses, setStatuses] = useState<RollStatuses>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.status])),
  );
  const headingId = useId();

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
        {canMarkAllPresent(students) && (
          <Button
            type="button"
            variant="glass"
            className="h-[38px] rounded-[11px] px-3"
            onClick={() => setStatuses((prev) => markAllPresent(students, prev))}
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
              <AttendanceRow
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

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 bg-[#FAFBFD] px-4 py-3.5">
          <p className="text-[13px] font-semibold text-ink-soft" aria-live="polite">
            {rollSummary(students, statuses)}
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
