"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { cn } from "@/lib/utils";
import {
  adminAssignTutorCover,
  adminMarkOutsideCover,
  adminReopenTutorCover,
  decideTutorLeave,
} from "@/app/_actions/tutor-cover";

// LoadingButton's own palette is the older portal one; these align it with the
// admin glass buttons (ink primary, hairline secondary) without forking it.
const BTN = "min-h-9 rounded-[10px] px-3.5 text-[13px] shadow-none";
const CARD_BTN = "min-h-[34px] rounded-[9px] px-3 text-[12px] shadow-none";
const INK = "border-ink bg-ink text-white hover:bg-[#2b2847]";
const LINE = "border-line-strong bg-surface text-ink hover:bg-surface-2";

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
        className={cn(BTN, LINE)}
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
        className={cn(BTN, INK)}
        pendingLabel="Posting…"
        successLabel="Posted"
        errorLabel="Try again"
      >
        Approve & post classes
      </LoadingButton>
      {error && (
        <p role="alert" className="w-full text-right text-[11px] font-semibold text-bad">
          {error}
        </p>
      )}
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
    <div className="flex w-full min-w-0 flex-wrap gap-1.5">
      <select
        required
        value={selectedTutorId}
        onChange={(event) => setSelectedTutorId(event.target.value)}
        disabled={busy}
        aria-label="Replacement tutor"
        className={cn(
          "h-[34px] min-w-0 flex-1 rounded-[9px] border border-line-strong bg-surface px-2 text-[12px] font-semibold",
          "focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400/30",
          selectedTutorId ? "text-ink" : "text-muted",
        )}
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
        className={cn(CARD_BTN, currentReplacementTutorId ? LINE : INK)}
        pendingLabel={currentReplacementTutorId ? "Changing…" : "Assigning…"}
        successLabel={currentReplacementTutorId ? "Changed" : "Assigned"}
        errorLabel="Try again"
      >
        {currentReplacementTutorId ? "Change" : "Assign"}
      </LoadingButton>
      {error && (
        <p role="alert" className="w-full text-[11px] font-semibold text-bad">
          {error}
        </p>
      )}
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
    <div className="flex flex-col gap-1">
      <LoadingButton
        onAction={reopen}
        disabled={busy}
        size="sm"
        className={cn(
          CARD_BTN,
          "w-full border-transparent bg-bad-bg text-bad hover:brightness-95",
        )}
        pendingLabel="Returning…"
        successLabel="Returned"
        errorLabel="Try again"
      >
        Return to board
      </LoadingButton>
      {error && (
        <p role="alert" className="text-[11px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * "Covered off the portal": someone who is not a portal tutor teaches (or
 * taught) the class. Their name is optional; the roll is marked by an admin.
 */
export function OutsideCoverForm({ coverRequestId }: { coverRequestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("coverRequestId", coverRequestId);
      formData.set("name", name);
      const result = await adminMarkOutsideCover(formData);
      if (!result.ok) {
        setError(result.error);
        throw new Error(result.error);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-[34px] w-full items-center justify-center rounded-[9px] border px-3 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
          LINE,
        )}
      >
        Covered by someone not on the portal
      </button>
    );
  }
  return (
    <div className="flex w-full min-w-0 flex-wrap gap-1.5">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={120}
        autoFocus
        aria-label="Who is teaching (optional)"
        placeholder="Who is teaching (optional)"
        className="h-[34px] min-w-0 flex-1 rounded-[9px] border border-line-strong bg-surface px-2 text-[12px] font-semibold text-ink placeholder:font-normal placeholder:text-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
      />
      <LoadingButton
        onAction={submit}
        disabled={busy}
        size="sm"
        className={cn(CARD_BTN, INK)}
        pendingLabel="Saving…"
        successLabel="Saved"
        errorLabel="Try again"
      >
        Save
      </LoadingButton>
      {error && (
        <p role="alert" className="w-full text-[11px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
