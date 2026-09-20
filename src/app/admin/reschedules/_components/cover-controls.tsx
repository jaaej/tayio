"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  adminAssignTutorCover,
  adminReopenTutorCover,
  decideTutorLeave,
} from "@/app/_actions/tutor-cover";

export function LeaveDecisionButtons({ leaveRequestId }: { leaveRequestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setError(null);
    setBusy(true);
    try {
      const result = await decideTutorLeave({ leaveRequestId, decision });
      if (!result.ok) {
        setError(result.error);
        throw new Error(result.error);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <LoadingButton
        disabled={busy}
        onAction={() => decide("reject")}
        size="sm"
        variant="danger"
        pendingLabel="Rejecting…"
        successLabel="Rejected"
        errorLabel="Try again"
      >
        Reject
      </LoadingButton>
      <LoadingButton
        disabled={busy}
        onAction={() => decide("approve")}
        size="sm"
        variant="brand"
        pendingLabel="Posting…"
        successLabel="Posted"
        errorLabel="Try again"
      >
        Approve & post classes
      </LoadingButton>
      {error && <p className="w-full text-right text-[11px] text-bad">{error}</p>}
    </div>
  );
}

export function AssignCoverForm({
  coverRequestId,
  originalTutorId,
  currentReplacementTutorId,
  tutors,
}: {
  coverRequestId: string;
  originalTutorId: string;
  currentReplacementTutorId?: string | null;
  tutors: Array<{ id: string; firstName: string; lastName: string }>;
}) {
  const router = useRouter();
  const [selectedTutorId, setSelectedTutorId] = useState(
    currentReplacementTutorId ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("coverRequestId", coverRequestId);
      formData.set("replacementTutorId", selectedTutorId);
      const result = await adminAssignTutorCover(formData);
      if (!result.ok) {
        setError(result.error);
        throw new Error(result.error);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-[260px] flex-wrap justify-end gap-2">
      <select
        required
        value={selectedTutorId}
        onChange={(event) => setSelectedTutorId(event.target.value)}
        disabled={busy}
        aria-label="Replacement tutor"
        className="min-h-9 max-w-44 rounded-[9px] border border-line bg-surface px-2.5 text-[12px] text-ink"
      >
        <option value="" disabled>Choose tutor…</option>
        {tutors
          .filter((tutor) => tutor.id !== originalTutorId)
          .map((tutor) => (
            <option key={tutor.id} value={tutor.id}>
              {tutor.firstName} {tutor.lastName}
            </option>
          ))}
      </select>
      <LoadingButton
        onAction={submit}
        disabled={busy || !selectedTutorId}
        size="sm"
        variant="brand"
        pendingLabel={currentReplacementTutorId ? "Changing…" : "Assigning…"}
        successLabel={currentReplacementTutorId ? "Changed" : "Assigned"}
        errorLabel="Try again"
      >
        {currentReplacementTutorId ? "Change tutor" : "Assign"}
      </LoadingButton>
      {error && <p className="w-full text-right text-[11px] text-bad">{error}</p>}
    </div>
  );
}

export function ReopenCoverButton({
  coverRequestId,
}: {
  coverRequestId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reopen() {
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("coverRequestId", coverRequestId);
      const result = await adminReopenTutorCover(formData);
      if (!result.ok) {
        setError(result.error);
        throw new Error(result.error);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <LoadingButton
        onAction={reopen}
        disabled={busy}
        size="sm"
        variant="danger"
        pendingLabel="Returning…"
        successLabel="Returned"
        errorLabel="Try again"
      >
        Return to board
      </LoadingButton>
      {error && <p className="max-w-64 text-right text-[11px] text-bad">{error}</p>}
    </div>
  );
}
