"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  approveAnnouncement,
  rejectAnnouncement,
} from "@/app/admin/_lib/actions-announcements";

export function AnnouncementReviewActions({ id }: { id: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (rejecting) {
    return (
      <div className="w-full space-y-2 rounded-[12px] bg-surface-2 p-3">
        <label
          htmlFor={`reject-${id}`}
          className="text-[12px] font-bold text-ink"
        >
          Reason for the tutor
        </label>
        <textarea
          id={`reject-${id}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={1000}
          className="mt-1.5 w-full rounded-[10px] border border-line-field bg-surface px-3 py-2 text-[13px] text-ink focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
          placeholder="Explain what needs changing…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <LoadingButton
            variant="danger"
            disabled={!reason.trim()}
            pendingLabel="Rejecting…"
            successLabel="Rejected"
            errorLabel="Try again"
            onAction={async () => {
              setError(null);
              const result = await rejectAnnouncement({ id, reason });
              if (!result.ok) {
                setError(result.error);
                throw new Error(result.error);
              }
            }}
          >
            Confirm rejection
          </LoadingButton>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRejecting(false)}
          >
            Cancel
          </Button>
          {error ? <span className="text-[12px] text-bad">{error}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRejecting(true)}
          className="h-[38px] flex-1 rounded-[11px]"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Reject
        </Button>
        <LoadingButton
          variant="neutral"
          pendingLabel="Approving…"
          successLabel="Published"
          errorLabel="Try again"
          className="min-h-[38px] flex-[1.8] rounded-[11px] border-ink bg-ink text-[13px] text-white hover:bg-[#2b2847]"
          onAction={async () => {
            setError(null);
            const result = await approveAnnouncement(id);
            if (!result.ok) {
              setError(result.error);
              throw new Error(result.error);
            }
          }}
        >
          Approve and publish
        </LoadingButton>
      </div>
      {error ? <span className="text-[12px] text-bad">{error}</span> : null}
    </div>
  );
}
