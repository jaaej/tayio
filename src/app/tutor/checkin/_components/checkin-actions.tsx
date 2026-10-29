"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import {
  approveTutorCheckin,
  disputeTutorCheckin,
} from "@/app/_actions/tutor-checkins";
import { Button } from "@/components/admin/ui";
import { ActionButtonLabel } from "@/components/ui/loading-button";

/**
 * The check-in card's footer: what admin corrected, then "Something's wrong"
 * (which opens the report to admin) and "Approve these hours".
 */
export function TutorCheckinActions({
  weekStart,
  status,
  hasEntries,
  hasMissingRate,
  notFinished,
  corrections,
  initialMessage,
}: {
  weekStart: string;
  status: "pending" | "approved" | "disputed";
  hasEntries: boolean;
  hasMissingRate: boolean;
  /** Some lessons this week have not finished yet, so approval must wait. */
  notFinished: boolean;
  /** What admin changed, one sentence each (`correctionLines`). */
  corrections: string[];
  initialMessage: string | null;
}) {
  const router = useRouter();
  const reportId = useId();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [reporting, setReporting] = useState(status === "disputed");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"approve" | "report" | null>(null);
  const canApprove = hasEntries && status !== "approved";

  function approve() {
    setError(null);
    setSaved(null);
    setAction("approve");
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
    setAction("report");
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

  // Why approval is unavailable, or that it is done.
  const state =
    status === "approved" && hasEntries
      ? "You approved these hours."
      : !canApprove
        ? null
        : hasMissingRate
          ? "Approval opens once admin sets your hourly rate."
          : notFinished
            ? "You can approve these hours once the week's last lesson has finished."
            : null;

  return (
    <div className="border-t border-line bg-[#FAFBFD]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
          {corrections.map((line) => (
            <p key={line} className="flex items-baseline gap-2 text-[13px] font-semibold text-info">
              <span className="inline-flex shrink-0 rounded-[6px] bg-info-bg px-1.5 py-0.5 text-[11px] font-extrabold">
                Corrected
              </span>
              <span className="min-w-0">{line}</span>
            </p>
          ))}
          {state && (
            <p
              className={
                status === "approved"
                  ? "flex items-center gap-1.5 text-[13px] font-bold text-good"
                  : "text-[13px] text-ink-soft"
              }
            >
              {status === "approved" && <CheckCircle2 className="h-4 w-4" aria-hidden />}
              {state}
            </p>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            aria-expanded={reporting}
            aria-controls={reportId}
            onClick={() => setReporting((v) => !v)}
            className="h-11 rounded-[11px] px-4 text-[14px]"
          >
            {hasEntries ? "Something's wrong" : "A lesson I taught is missing"}
          </Button>
          {canApprove && (
            <Button
              type="button"
              variant="primary"
              disabled={pending || hasMissingRate || notFinished}
              onClick={approve}
              className="h-11 rounded-[11px] px-4 text-[14px]"
            >
              <ActionButtonLabel pending={pending && action === "approve"} pendingLabel="Saving…">
                Approve these hours
              </ActionButtonLabel>
            </Button>
          )}
        </div>
      </div>

      {reporting && (
        <div id={reportId} className="flex flex-col gap-2 border-t border-line px-4 py-3.5 sm:px-5">
          <label htmlFor={`${reportId}-text`} className="text-[13px] text-ink-soft">
            Explain which class, date or time is wrong. Admin is notified and can
            correct it, or you can use{" "}
            <Link href="/tutor/messages" className="font-bold text-ink underline underline-offset-2">
              Messages
            </Link>
            .
          </label>
          <textarea
            id={`${reportId}-text`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={2000}
            autoFocus={status !== "disputed"}
            placeholder="For example: Tuesday ran 30 minutes over"
            className="w-full resize-y rounded-[12px] border border-line-field bg-surface p-3 text-[14px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setReporting(false)} className="h-10">
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || message.trim().length < 5}
              onClick={report}
              className="h-10"
            >
              <ActionButtonLabel pending={pending && action === "report"} pendingLabel="Sending…">
                Send to admin
              </ActionButtonLabel>
            </Button>
          </div>
        </div>
      )}

      {(error || saved) && (
        <p
          role={error ? "alert" : "status"}
          className={`px-4 pb-3.5 text-right text-[13px] font-semibold sm:px-5 ${error ? "text-bad" : "text-good"}`}
        >
          {error ?? saved}
        </p>
      )}
    </div>
  );
}
