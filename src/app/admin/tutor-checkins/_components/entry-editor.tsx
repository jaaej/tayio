"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  adminCorrectTutorCheckin,
  adminSetTutorCheckinEntryRemoved,
} from "@/app/_actions/tutor-checkins";
import { Button } from "@/components/admin/ui";
import { ActionButtonLabel } from "@/components/ui/loading-button";

const FIELD =
  "h-10 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[13px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

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

export function CheckinEntryEditor({
  entry,
  defaultOpen = false,
}: {
  entry: Entry;
  /** Start expanded, e.g. when it is the only row in the panel. */
  defaultOpen?: boolean;
}) {
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
    <details open={defaultOpen} className="group mt-3">
      <summary className="inline-flex h-[30px] cursor-pointer list-none items-center rounded-[9px] border border-line-strong bg-surface px-2.5 text-[12px] font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 group-open:mb-2.5 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Correct this row</span>
        <span className="hidden group-open:inline">Close</span>
      </summary>
      <form action={save} className="space-y-3 rounded-[12px] bg-surface-2 p-3.5">
        <p className="text-[12px] leading-relaxed text-ink-soft">
          This changes the payroll snapshot only. To change the actual class
          timetable, edit the class or lesson separately.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
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
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-[12px] font-bold text-ink-soft">
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
          <Button type="submit" disabled={pending}>
            <ActionButtonLabel pending={pending} pendingLabel="Saving…">
              Save correction
            </ActionButtonLabel>
          </Button>
          <Button
            type="button"
            variant={entry.isRemoved ? "outline" : "danger"}
            disabled={pending}
            onClick={() => setRemoved(!entry.isRemoved)}
          >
            {entry.isRemoved ? "Restore to pay" : "Remove from pay"}
          </Button>
          <span role="status" aria-live="polite" className="text-[12px] font-bold">
            {saved && <span className="text-good">Saved</span>}
            {error && <span className="text-bad">{error}</span>}
          </span>
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
      <span className="block text-[12px] font-bold text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}
