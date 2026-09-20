"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  approveTutorCheckin,
  disputeTutorCheckin,
} from "@/app/_actions/tutor-checkins";
import { ActionButtonLabel } from "@/components/ui/loading-button";

export function TutorCheckinActions({
  weekStart,
  status,
  hasEntries,
  hasMissingRate,
  initialMessage,
}: {
  weekStart: string;
  status: "pending" | "approved" | "disputed";
  hasEntries: boolean;
  hasMissingRate: boolean;
  initialMessage: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function approve() {
    setError(null);
    setSaved(null);
    start(async () => {
      const result = await approveTutorCheckin({ weekStart });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved("Week approved.");
      router.refresh();
    });
  }

  function report() {
    setError(null);
    setSaved(null);
    start(async () => {
      const result = await disputeTutorCheckin({ weekStart, message });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved("Admin has been notified.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {status === "approved" ? (
        <div className="flex items-start gap-3 rounded-[12px] border border-good/25 bg-good-bg p-4 text-good">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="text-[13px] font-extrabold">You approved this week</p>
            <p className="mt-0.5 text-[12px] leading-relaxed">
              If something is still wrong, report it below. Admin can correct
              the record and send it back for approval.
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending || !hasEntries || hasMissingRate}
          onClick={approve}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-600 px-5 text-[13px] font-extrabold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ActionButtonLabel pending={pending} pendingLabel="Saving…">
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Approve these hours
            </>
          </ActionButtonLabel>
        </button>
      )}

      {status !== "approved" && hasMissingRate && (
        <p className="text-[12px] font-semibold text-warn">
          Approval is unavailable until admin sets a valid hourly rate.
        </p>
      )}

      <details
        open={status === "disputed"}
        className="rounded-[12px] border border-line bg-surface-2/60 p-4"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-extrabold text-ink [&::-webkit-details-marker]:hidden">
          <AlertCircle className="h-4 w-4 text-warn" aria-hidden />
          Something is wrong with these hours
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-[12px] leading-relaxed text-muted">
            Explain the incorrect class, date or time. The owner-admin will be
            notified and can edit the record. You can also open{" "}
            <Link href="/tutor/messages" className="font-bold text-brand-700 underline">
              Messages
            </Link>
            .
          </p>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="For example: Tuesday's class finished at 6:00pm, not 5:30pm."
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[13px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25"
          />
          <button
            type="button"
            disabled={pending || message.trim().length < 5}
            onClick={report}
            className="min-h-10 rounded-full border border-line-strong bg-surface px-4 text-[12px] font-bold text-ink hover:border-warn hover:text-warn disabled:opacity-50"
          >
            <ActionButtonLabel pending={pending} pendingLabel="Sending…">
              Report to admin
            </ActionButtonLabel>
          </button>
        </div>
      </details>

      {error && <p className="text-[12px] font-semibold text-bad">{error}</p>}
      {saved && <p className="text-[12px] font-semibold text-good">{saved}</p>}
    </div>
  );
}
