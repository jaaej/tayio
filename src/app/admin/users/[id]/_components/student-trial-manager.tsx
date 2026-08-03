"use client";

import { useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/admin/ui";
import {
  setStudentTrial,
  clearStudentTrial,
} from "@/app/admin/_lib/actions-trial";
import { formatDateLong } from "@/lib/format";

type Trial = { startDate: string; endDate: string; note: string | null };

export function StudentTrialManager({
  studentId,
  trial,
}: {
  studentId: string;
  trial: Trial | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(trial?.startDate ?? "");
  const [endDate, setEndDate] = useState(trial?.endDate ?? "");
  const [note, setNote] = useState(trial?.note ?? "");

  function save() {
    setError(null);
    start(async () => {
      const res = await setStudentTrial({
        studentId,
        startDate,
        endDate,
        note: note || undefined,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function clear() {
    setError(null);
    start(async () => {
      await clearStudentTrial(studentId);
      setStartDate("");
      setEndDate("");
      setNote("");
    });
  }

  return (
    <div className="space-y-3">
      {trial ? (
        <div className="flex items-center gap-2 text-[13px]">
          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-[12px] font-bold text-brand-700">
            On trial
          </span>
          <span className="text-ink-soft">
            {formatDateLong(trial.startDate)} – {formatDateLong(trial.endDate)}
          </span>
        </div>
      ) : (
        <p className="text-[13px] text-muted">
          This student is not marked as on a free trial.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="trial-start">Trial start</Label>
          <Input
            id="trial-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="trial-end">Trial end</Label>
          <Input
            id="trial-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="trial-note">Note (optional)</Label>
        <Input
          id="trial-note"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. trialing Year 9 Maths"
        />
      </div>

      {error && <p className="text-[12px] font-semibold text-bad">{error}</p>}

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={pending || !startDate || !endDate}>
          {trial ? "Update trial" : "Set trial"}
        </Button>
        {trial && (
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="text-[13px] font-semibold text-muted hover:text-bad disabled:opacity-50"
          >
            Clear trial
          </button>
        )}
      </div>
    </div>
  );
}
