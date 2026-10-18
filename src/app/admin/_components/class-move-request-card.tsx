"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import {
  approvePermanentClassMove,
  rejectPermanentClassMove,
} from "@/app/_actions/class-moves";
import type { ClassMoveHistoryRow } from "@/lib/class-moves";
import { LoadingButton } from "@/components/ui/loading-button";

/**
 * A family's pending permanent class-move request with its decision: one
 * implementation for the Cover & leave queue and the student's Lessons tab.
 * `showStudent` names the student (the queue lists every family).
 */
export function ClassMoveRequestCard({
  request,
  showStudent = false,
}: {
  request: ClassMoveHistoryRow;
  showStudent?: boolean;
}) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        const message = result.error ?? "That didn't work. Try again.";
        setError(message);
        throw new Error(message);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[12px] border border-warn/25 bg-warn-bg/55 p-4">
      {showStudent && (
        <Link
          href={`/admin/users/${request.studentId}?tab=lessons#class-moves`}
          className="mb-1 inline-block text-[14px] font-extrabold text-ink hover:text-brand-700 hover:underline"
        >
          {request.studentName}
        </Link>
      )}
      <div className="text-[12px] font-extrabold text-ink">{request.fromLabel}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-ink-soft">
        <span>{request.fromSchedule}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="to" />
        <span>{request.toSchedule}</span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{request.reason}</p>
      <p className="mt-1 text-[11px] text-muted">Requested by {request.requestedByName}</p>

      {error && (
        <p role="alert" className="mt-3 rounded-[10px] bg-bad-bg px-3 py-2 text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}

      {declining ? (
        <div className="mt-3 space-y-2 border-t border-warn/20 pt-3">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            aria-label={`Note to the family about ${request.studentName}'s request`}
            placeholder="Optional explanation for the family"
            className="w-full resize-y rounded-[10px] border border-line-field bg-surface px-3 py-2.5 text-[12px] text-ink outline-none focus:border-brand-500"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeclining(false)}
              className="min-h-10 rounded-full border border-line-field bg-surface px-3.5 text-[11px] font-bold text-ink"
            >
              Keep pending
            </button>
            <LoadingButton
              disabled={busy}
              variant="danger"
              size="sm"
              pendingLabel="Declining…"
              successLabel="Declined"
              errorLabel="Try again"
              onAction={() =>
                decide(() => rejectPermanentClassMove({ requestId: request.id, note }))
              }
            >
              Confirm decline
            </LoadingButton>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-warn/20 pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => setDeclining(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-bad/30 bg-surface px-3.5 text-[11px] font-bold text-bad"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Decline
          </button>
          <LoadingButton
            disabled={busy}
            variant="success"
            size="sm"
            pendingLabel="Moving…"
            successLabel="Moved"
            errorLabel="Try again"
            onAction={() => decide(() => approvePermanentClassMove({ requestId: request.id }))}
          >
            Approve and move
          </LoadingButton>
        </div>
      )}
    </div>
  );
}
