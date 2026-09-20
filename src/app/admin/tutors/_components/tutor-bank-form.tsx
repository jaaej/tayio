"use client";

import { useState, useTransition } from "react";
import { setTutorBankDetails } from "@/app/admin/_lib/actions-tutor-bank";
import { ActionButtonLabel } from "@/components/ui/loading-button";

const INPUT =
  "h-9 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

type Bank = {
  accountName: string | null;
  bsb: string | null;
  accountNumber: string | null;
  hourlyRate: string | null;
  note: string | null;
};

export function TutorBankForm({
  tutorId,
  initial,
}: {
  tutorId: string;
  initial: Bank | null;
}) {
  const [accountName, setAccountName] = useState(initial?.accountName ?? "");
  const [bsb, setBsb] = useState(initial?.bsb ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initial?.accountNumber ?? "",
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [hourlyRate, setHourlyRate] = useState(initial?.hourlyRate ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveNote, setSaveNote] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    setStatus("idle");
    setSaveNote("");
    startTransition(async () => {
      try {
        const result = await setTutorBankDetails({
          tutorId,
          accountName,
          bsb,
          accountNumber,
          hourlyRate: hourlyRate === "" ? null : Number(hourlyRate),
          note,
        });
        setStatus("saved");
        setSaveNote(
          result.reopenedWeeks > 0
            ? `${result.reopenedWeeks} previously approved week${result.reopenedWeeks === 1 ? " was" : "s were"} reopened for tutor approval because the old rate was $0.`
            : result.openEntriesUpdated > 0
              ? `Updated ${result.openEntriesUpdated} pending payroll row${result.openEntriesUpdated === 1 ? "" : "s"}. Approved history was left unchanged.`
              : "Hourly rate saved. Approved payroll history was left unchanged.",
        );
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-muted">Account name</span>
          <input
            className={INPUT}
            value={accountName}
            onChange={(e) => {
              setAccountName(e.target.value);
              setStatus("idle");
            }}
            placeholder="e.g. Jane Smith"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-muted">Hourly rate (AUD)</span>
          <input
            className={INPUT}
            value={hourlyRate}
            onChange={(e) => {
              setHourlyRate(e.target.value);
              setStatus("idle");
            }}
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 35.00"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-muted">BSB</span>
          <input
            className={INPUT}
            value={bsb}
            onChange={(e) => {
              setBsb(e.target.value);
              setStatus("idle");
            }}
            placeholder="123-456"
            inputMode="numeric"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-muted">
            Account number
          </span>
          <input
            className={INPUT}
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value);
              setStatus("idle");
            }}
            placeholder="12345678"
            inputMode="numeric"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-bold text-muted">Note</span>
        <input
          className={INPUT}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setStatus("idle");
          }}
          placeholder="Optional - e.g. pay cycle, super fund"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-9 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <ActionButtonLabel pending={pending} pendingLabel="Saving…">
            Save details
          </ActionButtonLabel>
        </button>
        {status === "saved" && (
          <span className="text-[12px] font-semibold text-good">{saveNote}</span>
        )}
        {status === "error" && (
          <span className="text-[12px] font-semibold text-bad">
            Couldn&apos;t save - try again
          </span>
        )}
      </div>
    </div>
  );
}
