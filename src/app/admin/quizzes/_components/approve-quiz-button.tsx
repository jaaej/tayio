"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui";
import { approveQuiz } from "@/app/_actions/quizzes";

/**
 * Approve in place, without opening the quiz first. `approveQuiz` re-runs the
 * full submit validation, so a quiz that is not actually ready comes back with
 * a reason - which is shown here rather than dropped, since the button
 * otherwise looks like it simply did nothing.
 */
export function ApproveQuizButton({
  quizId,
  size = "md",
}: {
  quizId: string;
  size?: "sm" | "md";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="brand"
        size={size}
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await approveQuiz({ quizId });
            if (!res.ok) setError(res.error);
          });
        }}
      >
        {pending ? "Approving…" : "Approve"}
      </Button>
      {error && (
        <span
          role="alert"
          className="max-w-[220px] text-right text-[11px] font-semibold text-bad"
        >
          {error}
        </span>
      )}
    </span>
  );
}
