"use client";

import { useState, useTransition } from "react";
import { Check, Send } from "lucide-react";
import { sendHomeworkBump } from "../_actions";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { buttonVariants } from "@/components/admin/ui/button";
import { cn } from "@/lib/utils";

export function BumpMessageButton({ studentId }: { studentId: string }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function send() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await sendHomeworkBump(studentId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSent(true);
      } catch {
        setError("Couldn’t send the reminder. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={pending || sent}
        className={cn(
          buttonVariants({ variant: "outline", size: "md" }),
          // A sent reminder stays readable rather than greyed out.
          sent && "disabled:opacity-100 text-good",
        )}
      >
        <ActionButtonLabel pending={pending} pendingLabel="Sending…">
          <>
            {sent ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            {sent ? "Sent" : "Send reminder"}
          </>
        </ActionButtonLabel>
      </button>
      {error && (
        <span role="alert" className="max-w-48 text-right text-[12px] font-semibold text-bad">
          {error}
        </span>
      )}
    </div>
  );
}
