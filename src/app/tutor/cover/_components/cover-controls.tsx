"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelTutorCoverRequest,
  claimTutorCover,
  releaseTutorCover,
  withdrawTutorLeaveRequest,
} from "@/app/_actions/tutor-cover";
import { Button } from "@/components/admin/ui";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { cn } from "@/lib/utils";

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Card-sized button, matching the admin cover card's controls. */
const CARD_BTN = "h-[34px] rounded-[9px] px-3 text-[12px]";

function useAction(run: () => Promise<ActionResult>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return {
    pending,
    error,
    trigger() {
      setError(null);
      start(async () => {
        const result = await run();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      });
    },
  };
}

function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="w-full text-right text-[11px] font-semibold text-bad">
      {message}
    </p>
  );
}

export function CoverActionButton({
  coverRequestId,
  mode,
}: {
  coverRequestId: string;
  mode: "claim" | "release";
}) {
  const action = useAction(() =>
    mode === "claim"
      ? claimTutorCover(coverRequestId)
      : releaseTutorCover(coverRequestId),
  );
  return (
    <>
      <Button
        type="button"
        variant={mode === "claim" ? "primary" : "outline"}
        disabled={action.pending}
        onClick={action.trigger}
        className={cn(CARD_BTN, mode === "release" && "hover:border-bad hover:text-bad")}
      >
        <ActionButtonLabel
          pending={action.pending}
          pendingLabel={mode === "claim" ? "Claiming…" : "Releasing…"}
        >
          {mode === "claim" ? "Take this class" : "Release cover"}
        </ActionButtonLabel>
      </Button>
      <ActionError message={action.error} />
    </>
  );
}

/** Take back your own leave request (pending) or posted class (open). */
export function CancelTimeAwayButton({
  kind,
  id,
}: {
  kind: "leave" | "cover";
  id: string;
}) {
  const action = useAction(() =>
    kind === "leave" ? withdrawTutorLeaveRequest(id) : cancelTutorCoverRequest(id),
  );
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={action.pending}
        onClick={action.trigger}
        className={cn(CARD_BTN, "hover:border-bad hover:text-bad")}
      >
        <ActionButtonLabel pending={action.pending} pendingLabel="Cancelling…">
          Cancel request
        </ActionButtonLabel>
      </Button>
      <ActionError message={action.error} />
    </>
  );
}
