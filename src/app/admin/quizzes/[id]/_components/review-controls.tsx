"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui";
import { approveQuiz, requestChanges } from "@/app/_actions/quizzes";

/**
 * Admin review actions for a quiz: Approve (draft or pending_review) and, for
 * pending_review only, "Send back" - which reveals a required note textarea
 * before calling requestChanges.
 */
export function ReviewControls({ quizId, status }: { quizId: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  function approve() {
    setError(null);
    start(async () => {
      const res = await approveQuiz({ quizId });
      if (!res.ok) setError(res.error);
    });
  }

  function sendBack() {
    setError(null);
    if (note.trim().length === 0) {
      setError("Add a note explaining what needs to change.");
      return;
    }
    start(async () => {
      const res = await requestChanges({ quizId, note: note.trim() });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="brand" disabled={pending} onClick={approve}>
          {pending ? "Approving…" : "Approve"}
        </Button>
        {status === "pending_review" && !showNote && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setShowNote(true)}
          >
            Send back for changes
          </Button>
        )}
      </div>

      {showNote && (
        <div className="space-y-1.5">
          <label
            htmlFor="review-note"
            className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium"
          >
            What needs to change
          </label>
          <textarea
            id="review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="e.g. Question 2 has two correct answers marked"
            className="w-full rounded-xl border border-hairline/60 bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
          <div className="flex items-center gap-2.5 pt-1">
            <Button type="button" variant="danger" disabled={pending} onClick={sendBack}>
              {pending ? "Sending…" : "Confirm send back"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setShowNote(false);
                setNote("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
