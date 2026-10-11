"use client";

import { useState, useTransition } from "react";
import { setTutorBankDetails } from "@/app/admin/_lib/actions-tutor-bank";
import { Button } from "@/components/admin/ui";
import { ActionButtonLabel } from "@/components/ui/loading-button";

const INPUT =
  "h-[38px] w-full rounded-[10px] border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";
const LABEL = "flex flex-col gap-[5px] text-[12px] font-bold text-ink";

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
    const rate = hourlyRate === "" ? null : Number(hourlyRate);
    // Mirrors the server schema so a bad rate gets a specific message instead
    // of a generic failure.
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 10000)) {
      setStatus("error");
      setSaveNote("Hourly rate must be between $0 and $10,000.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await setTutorBankDetails({
          tutorId,
          accountName,
          bsb,
          accountNumber,
          hourlyRate: rate,
          note,
        });
        if (!result.ok) {
          setStatus("error");
          setSaveNote(result.error);
          return;
        }
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
        setSaveNote("Couldn't save - try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className={LABEL}>
          Account name
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
        <label className={LABEL}>
          Hourly rate (AUD)
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
        <label className={LABEL}>
          BSB
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
        <label className={LABEL}>
          Account number
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
      <label className={LABEL}>
        Note
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
      <div className="flex flex-wrap-reverse items-center justify-end gap-3">
        <span
          role="status"
          aria-live="polite"
          className={`min-w-0 flex-1 text-[12px] font-semibold ${status === "error" ? "text-bad" : "text-good"}`}
        >
          {status !== "idle" && saveNote}
        </span>
        <Button type="button" onClick={save} disabled={pending}>
          <ActionButtonLabel pending={pending} pendingLabel="Saving…">
            Save details
          </ActionButtonLabel>
        </Button>
      </div>
    </div>
  );
}
