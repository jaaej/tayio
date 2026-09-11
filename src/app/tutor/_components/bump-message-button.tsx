"use client";

import { useState, useTransition } from "react";
import { Check, Send } from "lucide-react";
import { sendHomeworkBump } from "../_actions";

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
        className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_4px_12px_-4px_rgba(50,58,145,0.4)] transition-all hover:bg-brand-700 disabled:cursor-default disabled:opacity-70"
      >
        {sent ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Send className="h-3.5 w-3.5" aria-hidden />
        )}
        {pending ? "Sending…" : sent ? "Sent" : "Send reminder"}
      </button>
      {error && (
        <span role="alert" className="max-w-48 text-right text-[10px] font-bold text-bad">
          {error}
        </span>
      )}
    </div>
  );
}
