"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Button, Empty, buttonVariants } from "@/components/admin/ui";
import { AttendanceRow, type RollStudent } from "@/components/attendance/attendance-row";
import { ActionSpinner } from "@/components/ui/loading-button";
import { adminSaveAttendance } from "@/app/admin/_lib/actions-attendance";
import { addStudentToLesson, removeStudentFromLesson } from "@/app/admin/_lib/actions-roll";
import {
  StudentSearch,
  type StudentOption,
} from "@/app/admin/subjects/[id]/edit/_components/student-search";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  canMarkAllPresent,
  markAllPresent,
  rollSummary,
  type RollStatuses,
} from "@/lib/attendance-roll";
import { cn } from "@/lib/utils";

export type MarkingStudent = RollStudent;

/** What the admin needs to add and take students off this lesson's roll. */
export type RollEdit = {
  /** Active students not on the roll. */
  candidates: StudentOption[];
  /** The lesson's day, "Tuesday 20 October", for the choices. */
  lessonDay: string;
  /** On the roll as class students (the rest are visiting this lesson). */
  classStudentIds: string[];
  /** Class students taken off this lesson alone, who can be put back. */
  excludedIds: string[];
  /** On the roll through a move, credit or tutor's note: not taken off here. */
  lockedIds: string[];
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
  headerAction,
  rollEdit,
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
  /** Extra action beside All present (Delete lesson on a lesson that ran). */
  headerAction?: ReactNode;
  /** Admin roll editing; absent on a make-up or a lesson that isn't running. */
  rollEdit?: RollEdit;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<RollStatuses>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.status])),
  );
  const headingId = useId();
  // The marks on screen: what was changed here, else what is saved. A student
  // added to the roll after the page loaded starts at their saved mark.
  const current: RollStatuses = Object.fromEntries(
    students.map((s) => [s.id, s.id in statuses ? (statuses[s.id] ?? null) : s.status]),
  );
  const { confirm, choose, confirmDialog } = useConfirm();
  const [rollPending, startRoll] = useTransition();
  const [rollError, setRollError] = useState<string | null>(null);

  function changeRoll(run: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setRollError(null);
    startRoll(async () => {
      const result = await run().catch(() => null);
      if (!result) setRollError("The roll could not be changed. Try again.");
      else if (!result.ok) setRollError(result.error);
      else router.refresh();
    });
  }

  async function onAdd(studentId: string) {
    if (!rollEdit || rollPending) return;
    const name = rollEdit.candidates.find((c) => c.id === studentId)?.name ?? "this student";
    let scope: "lesson" | "onwards" | null;
    if (rollEdit.excludedIds.includes(studentId)) {
      const ok = await confirm({ title: `Put ${name} back on this lesson?`, confirmLabel: "Put back" });
      scope = ok ? "lesson" : null;
    } else {
      const picked = await choose({
        title: `Add ${name} to this lesson?`,
        choices: {
          legend: "Which lessons",
          defaultValue: "lesson",
          options: [
            { value: "lesson", label: "This lesson only", detail: "A one-off visit. They don’t join the class." },
            { value: "onwards", label: "This lesson and after", detail: `They join the class from ${rollEdit.lessonDay}.` },
          ],
        },
        confirmLabel: "Add",
      });
      scope = picked === "lesson" || picked === "onwards" ? picked : null;
    }
    if (scope) changeRoll(() => addStudentToLesson({ lessonId, studentId, scope }));
  }

  async function onRemove(student: MarkingStudent) {
    if (!rollEdit || rollPending) return;
    const marked = current[student.id];
    let scope: "lesson" | "onwards" | null;
    if (rollEdit.classStudentIds.includes(student.id)) {
      const picked = await choose({
        title: `Take ${student.name} off this lesson?`,
        choices: {
          legend: "Which lessons",
          defaultValue: "lesson",
          options: [
            { value: "lesson", label: "This lesson only", detail: "They stay in the class, and it doesn’t count as an absence." },
            { value: "onwards", label: "This lesson and after", detail: `They leave the class from ${rollEdit.lessonDay}. Earlier lessons keep them.` },
          ],
        },
        note: marked ? "Their mark for this lesson is cleared." : undefined,
        confirmLabel: "Take off",
        danger: true,
      });
      scope = picked === "lesson" || picked === "onwards" ? picked : null;
    } else {
      const ok = await confirm({
        title: `Take ${student.name} off this lesson?`,
        body: "They’re visiting for this lesson only, so this removes the visit.",
        confirmLabel: "Take off",
        danger: true,
      });
      scope = ok ? "lesson" : null;
    }
    if (scope) changeRoll(() => removeStudentFromLesson({ lessonId, studentId: student.id, scope }));
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
        <div className="flex flex-wrap items-center gap-1.5">
          {rollEdit && rollEdit.candidates.length > 0 && (
            <StudentSearch tall options={rollEdit.candidates} onPick={onAdd} />
          )}
          {headerAction}
          {canMarkAllPresent(students) && (
            <Button
              type="button"
              variant="glass"
              className="h-[38px] rounded-[11px] px-3"
              onClick={() => setStatuses(markAllPresent(students, current))}
            >
              All present
            </Button>
          )}
        </div>
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
                status={current[s.id] ?? null}
                onChange={(status) =>
                  setStatuses((prev) => ({ ...prev, [s.id]: status }))
                }
                onRemove={rollEdit && !rollEdit.lockedIds.includes(s.id) ? () => onRemove(s) : undefined}
              />
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 bg-[#FAFBFD] px-4 py-3.5">
          <p className="text-[13px] font-semibold text-ink-soft" aria-live="polite">
            {rollSummary(students, current)}
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
      {rollError && (
        <p role="alert" className="px-3.5 py-2 text-[13px] font-semibold text-bad">
          {rollError}
        </p>
      )}
      {confirmDialog}
    </section>
  );
}
