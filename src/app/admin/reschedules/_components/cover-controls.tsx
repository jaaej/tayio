"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminAssignTutorCover,
  adminReopenTutorCover,
  decideTutorLeave,
} from "@/app/_actions/tutor-cover";

export function LeaveDecisionButtons({ leaveRequestId }: { leaveRequestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "approve" | "reject") {
    setError(null);
    start(async () => {
      const result = await decideTutorLeave({ leaveRequestId, decision });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => decide("reject")}
        className="min-h-9 rounded-full border border-line-strong bg-surface px-3.5 text-[12px] font-bold text-ink hover:border-bad hover:text-bad disabled:opacity-50"
      >
        Reject
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => decide("approve")}
        className="min-h-9 rounded-full bg-brand-600 px-3.5 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Approve & post classes"}
      </button>
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
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await adminAssignTutorCover(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex min-w-[260px] flex-wrap justify-end gap-2">
      <input type="hidden" name="coverRequestId" value={coverRequestId} />
      <select
        name="replacementTutorId"
        required
        defaultValue={currentReplacementTutorId ?? ""}
        disabled={pending}
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
      <button
        type="submit"
        disabled={pending}
        className="min-h-9 rounded-full bg-ink px-3.5 text-[12px] font-bold text-white disabled:opacity-50"
      >
        {pending
          ? currentReplacementTutorId
            ? "Changing…"
            : "Assigning…"
          : currentReplacementTutorId
            ? "Change tutor"
            : "Assign"}
      </button>
      {error && <p className="w-full text-right text-[11px] text-bad">{error}</p>}
    </form>
  );
}

export function ReopenCoverButton({
  coverRequestId,
}: {
  coverRequestId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reopen(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await adminReopenTutorCover(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={reopen} className="flex flex-col items-end gap-1">
      <input type="hidden" name="coverRequestId" value={coverRequestId} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-9 rounded-full border border-bad/40 bg-surface px-3.5 text-[12px] font-bold text-bad hover:bg-bad-bg disabled:opacity-50"
      >
        {pending ? "Returning…" : "Return to board"}
      </button>
      {error && <p className="max-w-64 text-right text-[11px] text-bad">{error}</p>}
    </form>
  );
}
