"use client";

import { useState, useTransition } from "react";
import { Pill, Button } from "@/components/admin/ui";
import {
  enrollStudent,
  setDeliveryMode,
  setTrialDates,
  withdrawStudent,
} from "@/app/admin/_lib/actions-enrollments";
import { deriveTrialStatus } from "@/lib/trials";

type DeliveryMode = "in_person" | "online";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  school?: string | null;
  deliveryMode?: DeliveryMode | null;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
};

export function EnrollmentsManager({
  classId,
  enrolled,
  availableStudents,
  capacity,
  today,
}: {
  classId: string;
  enrolled: Student[];
  availableStudents: Student[];
  capacity: number;
  /** YYYY-MM-DD, computed server-side so trial status stays pure/hydration-safe. */
  today: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [modeOverride, setModeOverride] = useState<Record<string, string>>({});
  const [trialDrafts, setTrialDrafts] = useState<
    Record<string, { start: string; end: string }>
  >({});
  const [pending, startTransition] = useTransition();

  function handleDelivery(studentId: string, value: string) {
    setModeOverride((prev) => ({ ...prev, [studentId]: value }));
    setError(null);
    const mode = value === "" ? null : (value as DeliveryMode);
    startTransition(async () => {
      await setDeliveryMode({ classId, studentId, mode });
    });
  }

  function trialDraftFor(s: Student) {
    return (
      trialDrafts[s.id] ?? {
        start: s.trialStartsAt ?? "",
        end: s.trialEndsAt ?? "",
      }
    );
  }

  function handleTrialDraftChange(
    s: Student,
    field: "start" | "end",
    value: string,
  ) {
    const current = trialDraftFor(s);
    setTrialDrafts((prev) => ({
      ...prev,
      [s.id]: { ...current, [field]: value },
    }));
  }

  function handleSetTrial(s: Student) {
    const draft = trialDraftFor(s);
    if (!draft.start || !draft.end) {
      setError("Set both a start and end date for the trial.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await setTrialDates({
        classId,
        studentId: s.id,
        trialStartsAt: draft.start,
        trialEndsAt: draft.end,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function handleClearTrial(s: Student) {
    setError(null);
    startTransition(async () => {
      const res = await setTrialDates({
        classId,
        studentId: s.id,
        trialStartsAt: null,
        trialEndsAt: null,
      });
      if (!res.ok) setError(res.error);
    });
    setTrialDrafts((prev) => {
      const next = { ...prev };
      delete next[s.id];
      return next;
    });
  }

  function handleAdd() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await enrollStudent({ classId, studentId: selected });
      if (!res.ok) setError(res.error);
      else setSelected("");
    });
  }

  function handleRemove(studentId: string) {
    if (
      !confirm("Withdraw this student from the class? Past records are kept.")
    )
      return;
    setError(null);
    startTransition(async () => {
      await withdrawStudent({ classId, studentId });
    });
  }

  const atCapacity = enrolled.length >= capacity;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-bold text-ink-soft tabular-nums">
          {enrolled.length} of {capacity} enrolled
        </div>
        {atCapacity && <Pill tone="warn">At capacity</Pill>}
      </div>

      {enrolled.length === 0 ? (
        <div className="text-[13px] text-muted italic">
          No students enrolled yet.
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-[14px] border border-line overflow-hidden">
          {enrolled.map((s) => {
            const trialStatus = deriveTrialStatus(
              s.trialStartsAt ?? null,
              s.trialEndsAt ?? null,
              today,
            );
            const draft = trialDraftFor(s);
            const hasTrial = !!s.trialEndsAt;
            return (
              <li
                key={s.id}
                className="px-5 py-3.5 hover:bg-surface-2 transition-colors space-y-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-ink truncate">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {s.school ? `${s.school} · ${s.email}` : s.email}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <select
                      aria-label={`Delivery mode for ${s.firstName} ${s.lastName}`}
                      value={modeOverride[s.id] ?? s.deliveryMode ?? ""}
                      onChange={(e) => handleDelivery(s.id, e.target.value)}
                      disabled={pending}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-ink disabled:opacity-50"
                    >
                      <option value="">Default</option>
                      <option value="in_person">In person</option>
                      <option value="online">Online</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemove(s.id)}
                      disabled={pending}
                      className="text-[11px] uppercase tracking-[0.16em] font-bold text-bad hover:brightness-90 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted-2">
                    Trial
                  </span>
                  <input
                    type="date"
                    aria-label={`Trial start date for ${s.firstName} ${s.lastName}`}
                    value={draft.start}
                    onChange={(e) =>
                      handleTrialDraftChange(s, "start", e.target.value)
                    }
                    disabled={pending}
                    className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-ink disabled:opacity-50"
                  />
                  <span className="text-[12px] text-muted-2">to</span>
                  <input
                    type="date"
                    aria-label={`Trial end date for ${s.firstName} ${s.lastName}`}
                    value={draft.end}
                    onChange={(e) =>
                      handleTrialDraftChange(s, "end", e.target.value)
                    }
                    disabled={pending}
                    className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-ink disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => handleSetTrial(s)}
                    disabled={pending}
                    className="text-[11px] uppercase tracking-[0.16em] font-bold text-brand-700 hover:brightness-90 disabled:opacity-50"
                  >
                    Set trial
                  </button>
                  {hasTrial && (
                    <button
                      type="button"
                      onClick={() => handleClearTrial(s)}
                      disabled={pending}
                      className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted hover:text-ink disabled:opacity-50"
                    >
                      Clear
                    </button>
                  )}
                  {trialStatus === "on_trial" && (
                    <Pill tone="info">On trial</Pill>
                  )}
                  {trialStatus === "trial_ended" && (
                    <Pill tone="warn">Trial ended</Pill>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-line pt-4 space-y-2">
        <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
          Add a student
        </div>
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] text-ink"
            disabled={pending}
          >
            <option value="">- Select a student -</option>
            {availableStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} · {s.email}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!selected || pending}
          >
            {pending ? "Adding…" : "Add"}
          </Button>
        </div>
        {availableStudents.length === 0 && (
          <div className="text-xs text-muted">
            All students are already enrolled in this class.
          </div>
        )}
      </div>

      {error && <div className="text-[13px] font-semibold text-bad">{error}</div>}
    </div>
  );
}
