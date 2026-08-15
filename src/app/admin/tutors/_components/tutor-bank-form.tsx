"use client";

import { useState, useTransition } from "react";
import { setTutorBankDetails } from "@/app/admin/_lib/actions-tutor-bank";

const INPUT =
  "h-9 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

type Bank = {
  accountName: string | null;
  bsb: string | null;
  accountNumber: string | null;
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
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  function save() {
    setStatus("idle");
    startTransition(async () => {
      try {
        await setTutorBankDetails({
          tutorId,
          accountName,
          bsb,
          accountNumber,
          note,
        });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-3">
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
          {pending ? "Saving…" : "Save details"}
        </button>
        {status === "saved" && (
          <span className="text-[12px] font-semibold text-good">Saved</span>
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
