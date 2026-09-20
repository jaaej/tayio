"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  adminCorrectTutorCheckin,
  adminSetTutorCheckinEntryRemoved,
} from "@/app/_actions/tutor-checkins";
import { ActionButtonLabel } from "@/components/ui/loading-button";

const FIELD =
  "h-10 w-full rounded-[9px] border border-line bg-surface px-3 text-[12px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

type Entry = {
  id: string;
  subjectName: string;
  className: string;
  workDate: string;
  startTime: string;
  endTime: string;
  hourlyRate: string;
  note: string | null;
  isRemoved: boolean;
  updatedAt: Date | string;
};

export function CheckinEntryEditor({ entry }: { entry: Entry }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const expectedUpdatedAt = new Date(entry.updatedAt).toISOString();

  function save(formData: FormData) {
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await adminCorrectTutorCheckin({
        entryId: entry.id,
        subjectName: String(formData.get("subjectName") ?? ""),
        className: String(formData.get("className") ?? ""),
        workDate: String(formData.get("workDate") ?? ""),
        startTime: String(formData.get("startTime") ?? ""),
        endTime: String(formData.get("endTime") ?? ""),
        hourlyRate: String(formData.get("hourlyRate") ?? ""),
        note: String(formData.get("note") ?? ""),
        expectedUpdatedAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function setRemoved(removed: boolean) {
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await adminSetTutorCheckinEntryRemoved({
        entryId: entry.id,
        removed,
        expectedUpdatedAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <details className="group border-t border-line bg-surface-2/50">
      <summary className="cursor-pointer list-none px-5 py-2.5 text-right text-[11px] font-bold text-brand-700 hover:text-ink [&::-webkit-details-marker]:hidden">
        Edit payroll row
      </summary>
      <form action={save} className="space-y-3 border-t border-line px-5 py-4">
        <p className="text-[11px] leading-relaxed text-muted">
          This changes the payroll snapshot only. To change the actual class
          timetable, edit the class or lesson separately.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Subject">
            <input
              name="subjectName"
              required
              maxLength={160}
              defaultValue={entry.subjectName}
              className={FIELD}
            />
          </Field>
          <Field label="Class">
            <input
              name="className"
              required
              maxLength={160}
              defaultValue={entry.className}
              className={FIELD}
            />
          </Field>
          <Field label="Work date">
            <input
              name="workDate"
              type="date"
              required
              defaultValue={entry.workDate}
              className={FIELD}
            />
          </Field>
          <Field label="Hourly rate (AUD)">
            <input
              name="hourlyRate"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              required
              defaultValue={entry.hourlyRate}
              className={FIELD}
            />
          </Field>
          <Field label="Start">
            <input
              name="startTime"
              type="time"
              required
              defaultValue={entry.startTime.slice(0, 5)}
              className={FIELD}
            />
          </Field>
          <Field label="Finish">
            <input
              name="endTime"
              type="time"
              required
              defaultValue={entry.endTime.slice(0, 5)}
              className={FIELD}
            />
          </Field>
          <label className="space-y-1 md:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              Admin note
            </span>
            <input
              name="note"
              maxLength={1000}
              defaultValue={entry.note ?? ""}
              placeholder="Reason for the correction"
              className={FIELD}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="min-h-9 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <ActionButtonLabel pending={pending} pendingLabel="Saving…">
              Save correction
            </ActionButtonLabel>
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRemoved(!entry.isRemoved)}
            className={`min-h-9 rounded-full border px-4 text-[12px] font-bold disabled:opacity-50 ${
              entry.isRemoved
                ? "border-good/40 bg-surface text-good"
                : "border-bad/40 bg-surface text-bad"
            }`}
          >
            {entry.isRemoved ? "Restore to pay" : "Remove from pay"}
          </button>
          {saved && <span className="text-[11px] font-bold text-good">Saved</span>}
          {error && <span className="text-[11px] font-bold text-bad">{error}</span>}
        </div>
      </form>
    </details>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
