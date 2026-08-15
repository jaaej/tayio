"use client";

import { useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/admin/ui";
import {
  addStudentLeave,
  removeStudentLeave,
} from "@/app/admin/_lib/actions-leave";
import { formatDateLong } from "@/lib/format";

type Period = {
  id: string;
  startDate: string;
  endDate: string;
  note: string | null;
};

export function StudentLeaveManager({
  studentId,
  periods,
}: {
  studentId: string;
  periods: Period[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");

  function handleAdd() {
    setError(null);
    start(async () => {
      const res = await addStudentLeave({
        studentId,
        startDate,
        endDate,
        note: note || undefined,
      });
      if (!res.ok) setError(res.error);
      else {
        setStartDate("");
        setEndDate("");
        setNote("");
      }
    });
  }

  function handleRemove(id: string) {
    if (!confirm("Remove this leave period?")) return;
    setError(null);
    start(async () => {
      await removeStudentLeave(id, studentId);
    });
  }

  return (
    <div className="space-y-4">
      {periods.length === 0 ? (
        <div className="text-[13px] text-muted italic">
          No leave or holidays recorded.
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-[14px] border border-line overflow-hidden">
          {periods.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-ink tabular-nums">
                  {formatDateLong(p.startDate)}
                  {p.endDate !== p.startDate
                    ? ` – ${formatDateLong(p.endDate)}`
                    : ""}
                </div>
                {p.note && (
                  <div className="text-xs text-muted truncate">{p.note}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(p.id)}
                disabled={pending}
                className="shrink-0 text-[11px] uppercase tracking-[0.16em] font-bold text-bad hover:brightness-90 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line pt-4 space-y-3">
        <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
          Add a leave period
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="leave-start">From</Label>
            <Input
              id="leave-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leave-end">To</Label>
            <Input
              id="leave-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leave-note">Note (optional)</Label>
          <Input
            id="leave-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Family holiday"
            maxLength={200}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="brand"
            onClick={handleAdd}
            disabled={pending || !startDate || !endDate}
          >
            {pending ? "Saving…" : "Add leave"}
          </Button>
          {error && (
            <span className="text-[12px] font-semibold text-bad">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
}
