"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cancelLessonForAll, getLessonCancelPreview } from "@/app/admin/_lib/actions-lesson-cancel";
import { cn } from "@/lib/utils";

/**
 * "Cancel lesson" for an admin, on the cover board and the lesson's page:
 * shows who it affects, then cancels it for everyone (each student gets a
 * class credit; students, parents and the tutor are told).
 */
export function CancelLessonButton({
  lessonId,
  subject,
  className,
  variant = "quiet",
}: {
  lessonId: string;
  /** The lesson as one line, "Year 9 Maths · Saturday 24 October · 10:00 am". */
  subject: { label: string; dot?: string };
  className?: string;
  /** "quiet" in a header; "card" on a cover board card. */
  variant?: "quiet" | "card";
}) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onCancel() {
    setError(null);
    const preview = await getLessonCancelPreview(lessonId).catch(() => null);
    if (!preview?.ok) {
      setError(preview?.error ?? "Could not check this lesson. Try again.");
      return;
    }
    const { impact } = preview;
    if (impact.refusal) {
      setError(impact.refusal);
      return;
    }
    const n = impact.students.length;
    const ok = await confirm({
      title: "Cancel this lesson?",
      subject,
      body:
        n > 0
          ? `${n === 1 ? "This student gets" : `These ${n} students each get`} a class credit to book a make-up. They, their parents and the tutor are told it's cancelled.`
          : "Nobody is booked on it. The tutor is told it's cancelled.",
      items: impact.students.map((s) => s.name),
      confirmLabel: "Cancel lesson",
      cancelLabel: "Keep it",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const result = await cancelLessonForAll(lessonId).catch(() => null);
      if (!result) setError("The lesson could not be cancelled. Try again.");
      else if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60",
          variant === "card"
            ? "min-h-[34px] w-full rounded-[9px] bg-bad-bg px-3 text-[12px] text-bad hover:brightness-95"
            : "h-[38px] rounded-[11px] px-3 text-[13px] text-ink-soft hover:bg-[#FDE8E8] hover:text-[#B42318]",
          className,
        )}
      >
        <CalendarX2 className="h-[15px] w-[15px]" strokeWidth={1.9} aria-hidden />
        {pending ? "Cancelling…" : variant === "card" ? "Can't find a tutor: cancel lesson" : "Cancel lesson"}
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
