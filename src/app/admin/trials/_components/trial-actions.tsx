"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  setTrialDates,
  withdrawStudent,
} from "@/app/admin/_lib/actions-enrollments";

export function TrialActions({
  classId,
  studentId,
  studentName,
  className,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  className: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConvert() {
    if (
      !confirm(
        `Convert ${studentName} to a regular enrollment in ${className}? This clears the trial dates.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await setTrialDates({
        classId,
        studentId,
        trialStartsAt: null,
        trialEndsAt: null,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function handleWithdraw() {
    if (
      !confirm(
        `Withdraw ${studentName} from ${className}? Past records are kept.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      await withdrawStudent({ classId, studentId });
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="inline-flex items-center gap-3 justify-end">
        <Link
          href={`/admin/classes/${classId}`}
          className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700 hover:text-brand-600"
        >
          View class
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={handleConvert}
          className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft hover:text-ink disabled:opacity-50"
        >
          Convert to regular
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleWithdraw}
          className="text-[11px] font-bold uppercase tracking-[0.14em] text-bad hover:brightness-90 disabled:opacity-50"
        >
          Withdraw
        </button>
      </div>
      {error && (
        <div className="text-[11px] font-semibold text-bad">{error}</div>
      )}
    </div>
  );
}
