"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, Empty } from "@/components/admin/ui";
import { AttendanceRow, type RollStudent } from "@/components/attendance/attendance-row";
import { ActionSpinner } from "@/components/ui/loading-button";
import { saveAttendance } from "@/app/tutor/_actions";
import {
  canMarkAllPresent,
  markAllPresent,
  rollSummary,
  type RollStatuses,
} from "@/lib/attendance-roll";

/**
 * The tutor's attendance roll for one lesson: the same rows and segmented
 * control as admin Attendance. Enrolled students and make-up attendees are one
 * roll and one save; the server re-checks each student against this lesson.
 */
export function LessonAttendance({
  lessonId,
  students,
  enrolledCount,
  makeupCount,
}: {
  lessonId: string;
  students: RollStudent[];
  enrolledCount: number;
  makeupCount: number;
}) {
  const router = useRouter();
  const headingId = useId();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<"saved" | "error" | null>(null);
  const [statuses, setStatuses] = useState<RollStatuses>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.status])),
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      try {
        await saveAttendance(formData);
      } catch {
        setResult("error");
        return;
      }
      setResult("saved");
      router.refresh();
    });
  }

  const meta = [
    `${enrolledCount} enrolled`,
    makeupCount > 0 ? `${makeupCount} make-up` : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <section
      aria-labelledby={headingId}
      className="glass flex min-w-0 flex-[999_1_560px] flex-col rounded-[24px] p-1.5"
    >
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 py-1.5 pl-3 pr-1.5">
        <h2 id={headingId} className="text-[16px] font-extrabold text-ink">
          Attendance{" "}
          <span className="text-[13px] font-semibold text-ink-soft">· {meta}</span>
        </h2>
        {canMarkAllPresent(students) && (
          <Button
            type="button"
            variant="glass"
            className="h-[38px] rounded-[11px] px-3"
            onClick={() => {
              setResult(null);
              setStatuses((prev) => markAllPresent(students, prev));
            }}
          >
            All present
          </Button>
        )}
      </div>

      {students.length === 0 ? (
        <div className="panel">
          <Empty>No students are enrolled in this class yet.</Empty>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          onChange={() => setResult(null)}
          className="panel flex min-w-0 flex-col overflow-hidden"
        >
          <input type="hidden" name="lessonId" value={lessonId} />
          <ul>
            {students.map((s) => (
              <AttendanceRow
                key={s.id}
                student={s}
                status={statuses[s.id] ?? null}
                onChange={(status) => {
                  setResult(null);
                  setStatuses((prev) => ({ ...prev, [s.id]: status }));
                }}
              />
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAFBFD] px-4 py-3.5">
            <p className="text-[13px] font-semibold text-ink-soft" aria-live="polite">
              {rollSummary(students, statuses)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {result === "saved" && (
                <span role="status" className="inline-flex items-center gap-1 text-[13px] font-bold text-good">
                  <Check className="h-4 w-4" aria-hidden />
                  Saved
                </span>
              )}
              <Button
                type="submit"
                disabled={pending}
                aria-busy={pending || undefined}
                className="h-10 rounded-[11px] px-[18px] text-[14px]"
              >
                {pending && <ActionSpinner />}
                Save attendance
              </Button>
            </div>
            {result === "error" && (
              <p role="alert" className="w-full text-right text-[12px] font-semibold text-bad">
                Attendance could not be saved. Check the roll and try again.
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
