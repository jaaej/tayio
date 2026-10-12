"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown } from "lucide-react";
import {
  approveTutorCheckin,
  disputeTutorCheckin,
} from "@/app/_actions/tutor-checkins";
import { Button } from "@/components/admin/ui";
import { ActionButtonLabel } from "@/components/ui/loading-button";

export function TutorCheckinActions({
  weekStart,
  status,
  hasEntries,
  hasMissingRate,
  correctedCount,
  notFinished,
  initialMessage,
}: {
  weekStart: string;
  status: "pending" | "approved" | "disputed";
  hasEntries: boolean;
  hasMissingRate: boolean;
  /** Lessons admin corrected, which the tutor should check before approving. */
  correctedCount: number;
  /** Some lessons this week have not finished yet, so approval must wait. */
  notFinished: boolean;
  initialMessage: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"approve" | "report" | null>(null);

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

  return (
    <div className="flex flex-col gap-3.5">
      {!hasEntries ? (
        // Nothing to approve, but a missing lesson can still be reported.
        <p className="text-[14px] text-ink-soft">
          There are no lessons to approve this week.
        </p>
      ) : status === "approved" ? (
        <div className="flex items-start gap-3 rounded-[12px] bg-good-bg p-3.5 text-good">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="text-[14px] font-extrabold">You approved this week</p>
            <p className="mt-0.5 text-[13px] leading-relaxed">
              If something is still wrong, report it below. Admin can correct the
              record and send it back for approval.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-[1_1_300px] text-[14px] leading-normal text-ink">
            {hasMissingRate
              ? "Approval is unavailable until admin sets your hourly rate."
              : notFinished
                ? "You can approve these hours once the week's last lesson has finished."
                : "Approving tells admin these hours are right so they can go into payroll."}
            {correctedCount > 0 &&
              ` Admin corrected ${correctedCount === 1 ? "1 lesson" : `${correctedCount} lessons`} - check ${correctedCount === 1 ? "it matches" : "they match"} what you worked.`}
          </p>
          <Button
            type="button"
            size="lg"
            variant="primary"
            disabled={pending || hasMissingRate || notFinished}
            onClick={approve}
          >
            <ActionButtonLabel pending={pending && action === "approve"} pendingLabel="Saving…">
              Approve these hours
            </ActionButtonLabel>
          </Button>
        </div>
      )}

      <details
        open={status === "disputed" || undefined}
        className="group border-t border-line pt-3"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-[8px] text-[13px] font-bold text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 [&::-webkit-details-marker]:hidden">
          <ChevronDown
            className="h-4 w-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
          Something is wrong with these hours
        </summary>
        <div className="flex flex-col gap-2 pt-1">
          <label htmlFor="checkin-report" className="text-[13px] text-ink-soft">
            Explain which class, date or time is wrong. Admin is notified and can
            correct the record, or you can use{" "}
            <Link href="/tutor/messages" className="font-bold text-ink underline underline-offset-2">
              Messages
            </Link>
            .
          </label>
          <textarea
            id="checkin-report"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What’s wrong? For example: Tuesday ran 30 minutes over"
            className="w-full resize-y rounded-[12px] border border-line-field bg-surface p-3 text-[14px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || message.trim().length < 5}
            onClick={report}
            className="h-10 self-end"
          >
            <ActionButtonLabel pending={pending && action === "report"} pendingLabel="Sending…">
              Report to admin
            </ActionButtonLabel>
          </Button>
        </div>
      </details>

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-[13px] font-semibold text-good">
          {saved}
        </p>
      )}
    </div>
  );
}
