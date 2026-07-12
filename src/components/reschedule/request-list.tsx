"use client";

import { useState, useTransition } from "react";
import { approveReschedule, rejectReschedule } from "@/app/_actions/reschedule";

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
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function act(id: string, kind: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    start(async () => {
      const res =
        kind === "approve"
          ? await approveReschedule(id)
          : await rejectReschedule(id);
      if (res.ok) {
        setRows((r) => r.filter((x) => x.id !== id));
      } else {
        setError(res.error);
      }
      setBusyId(null);
    });
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
              <button
                type="button"
                onClick={() => act(r.id, "reject")}
                disabled={pending && busyId === r.id}
                className="rounded-[10px] border border-line px-3 py-1.5 text-[13px] font-bold text-ink-soft hover:bg-surface-2 disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => act(r.id, "approve")}
                disabled={pending && busyId === r.id}
                className="rounded-[10px] bg-brand-500 px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {pending && busyId === r.id ? "…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
