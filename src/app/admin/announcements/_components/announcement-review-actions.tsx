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
      <div className="w-full max-w-md space-y-2 rounded-[12px] border border-line bg-surface-2 p-3">
        <label
          htmlFor={`reject-${id}`}
          className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted"
        >
          Reason for the tutor
        </label>
        <textarea
          id={`reject-${id}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
    <div className="flex flex-wrap items-center gap-2">
      <LoadingButton
        variant="brand"
        pendingLabel="Approving…"
        successLabel="Published"
        errorLabel="Try again"
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
      <Button
        type="button"
        variant="danger"
        onClick={() => setRejecting(true)}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        Reject
      </Button>
      {error ? <span className="text-[12px] text-bad">{error}</span> : null}
    </div>
  );
}
