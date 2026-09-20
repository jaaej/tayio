"use client";

import { useState } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
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
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <LoadingButton
        variant="brand"
        size={size}
        pendingLabel="Approving…"
        successLabel="Approved"
        errorLabel="Try again"
        onAction={async () => {
          setError(null);
          const res = await approveQuiz({ quizId });
          if (!res.ok) {
            setError(res.error);
            throw new Error(res.error);
          }
        }}
      >
        Approve
      </LoadingButton>
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
