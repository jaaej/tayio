"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui";
import { sendPaymentReminder } from "@/app/admin/_lib/actions-invoices";

export function SendReminderButton({
  parentId,
  parentName,
}: {
  parentId: string;
  parentName: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {result && (
        <span
          role="status"
          className={`text-[12px] font-bold ${result.ok ? "text-good" : "text-bad"}`}
        >
          {result.text}
        </span>
      )}
      <Button
        type="button"
        variant="glass"
        size="md"
        disabled={pending || result?.ok === true}
        aria-label={`Send reminder to ${parentName}`}
        onClick={() => {
          setResult(null);
          start(async () => {
            try {
              const res = await sendPaymentReminder(parentId);
              setResult(res.ok ? { ok: true, text: "Sent" } : { ok: false, text: res.error });
            } catch {
              setResult({ ok: false, text: "Reminder failed. Try again." });
            }
          });
        }}
      >
        {pending ? "Sending…" : "Send reminder"}
      </Button>
    </span>
  );
}
