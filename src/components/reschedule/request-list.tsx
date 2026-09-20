"use client";

import { useState } from "react";
import { approveReschedule, rejectReschedule } from "@/app/_actions/reschedule";
import { LoadingButton } from "@/components/ui/loading-button";

export type PendingRow = {
  id: string;
  studentName: string;
  subjectName: string;
  fromLabel: string;
  toLabel: string;
  reason: string | null;
};

/** Approver queue (tutor + admin). First to act wins; decided rows drop out. */
export function RescheduleRequestList({ requests }: { requests: PendingRow[] }) {
  const [rows, setRows] = useState(requests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, kind: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res =
        kind === "approve"
          ? await approveReschedule(id)
          : await rejectReschedule(id);
      if (res.ok) {
        setRows((r) => r.filter((x) => x.id !== id));
      } else {
        setError(res.error);
        throw new Error(res.error);
      }
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-6 text-[14px] text-muted">
        No pending reschedule requests.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-[13px] font-semibold text-bad">{error}</div>
      )}
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-[14px] border border-line bg-surface p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-ink">
                {r.studentName} · {r.subjectName}
              </div>
              <div className="mt-1 text-[13px] text-ink-soft">
                <span className="text-muted">From</span> {r.fromLabel}{" "}
                <span className="text-muted">→ to</span> {r.toLabel}
              </div>
              {r.reason && (
                <div className="mt-1 text-[12px] italic text-muted">
                  “{r.reason}”
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LoadingButton
                onAction={() => act(r.id, "reject")}
                disabled={busyId !== null}
                size="sm"
                pendingLabel="Declining…"
                successLabel="Declined"
                errorLabel="Try again"
              >
                Decline
              </LoadingButton>
              <LoadingButton
                onAction={() => act(r.id, "approve")}
                disabled={busyId !== null}
                size="sm"
                variant="brand"
                pendingLabel="Approving…"
                successLabel="Approved"
                errorLabel="Try again"
              >
                Approve
              </LoadingButton>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
