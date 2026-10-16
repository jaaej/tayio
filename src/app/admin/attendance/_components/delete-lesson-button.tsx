"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteLesson, getLessonDeletionImpact } from "@/app/admin/_lib/actions-attendance";
import { useConfirm } from "@/components/ui/confirm-dialog";

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Delete a lesson that has run, after a confirmation listing its attendance
 * and notes. This is how a class with history is cleared for deletion.
 */
export function DeleteLessonButton({
  lessonId,
  subject,
  backHref,
}: {
  lessonId: string;
  /** The line naming the lesson in the dialog, with its subject colour. */
  subject: { label: string; dot: string };
  /** Where to go once it is deleted (the queue it was opened from). */
  backHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  async function onDelete() {
    setError(null);
    setBusy(true);
    const checked = await getLessonDeletionImpact(lessonId).catch(() => null);
    setBusy(false);
    if (!checked?.ok) {
      setError(checked?.error ?? "Could not check this lesson. Try again.");
      return;
    }
    const { impact } = checked;
    const items = [
      impact.attendanceRecords > 0 ? count(impact.attendanceRecords, "attendance record") : null,
      impact.lessonNotes > 0 ? count(impact.lessonNotes, "lesson note") : null,
    ].filter((item): item is string => item !== null);
    const ok = await confirm({
      icon: "delete",
      title: "Delete this lesson?",
      subject,
      body: items.length > 0 ? "This permanently removes:" : "Nothing was recorded on this lesson.",
      items,
      note: impact.homework > 0 ? "Homework set in this lesson, and its marks, are kept." : undefined,
      warning: "This can’t be undone.",
      confirmLabel: "Delete lesson",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const result = await deleteLesson(lessonId).catch(() => null);
    if (!result?.ok) {
      setBusy(false);
      setError(result?.error ?? "Could not delete the lesson. Try again.");
      return;
    }
    router.push(backHref);
  }

  return (
    <>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="flex h-[38px] items-center gap-1.5 rounded-[11px] px-3 text-[13px] font-bold text-ink-soft transition-colors hover:bg-[#FDE8E8] hover:text-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
      >
        <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.9} aria-hidden />
        {busy ? "Working…" : "Delete lesson"}
      </button>
      {error && (
        <p role="alert" className="w-full text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
      {confirmDialog}
    </>
  );
}
