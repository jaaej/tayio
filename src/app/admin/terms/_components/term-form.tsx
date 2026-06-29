"use client";

import { useState, useTransition } from "react";
import {
  createTerm,
  updateTerm,
  deleteTerm,
} from "@/app/admin/_lib/actions-terms";
import { Button } from "@/components/admin/ui";
import type { Term } from "@/db/schema";

export function TermForm({ existing }: { existing?: Term }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = existing
        ? await updateTerm(existing.id, formData)
        : await createTerm(formData);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <form action={submit} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
      <label>
        <div className="text-[12px] font-bold text-ink-soft mb-1">Year</div>
        <input
          name="year"
          type="number"
          defaultValue={existing?.year ?? new Date().getFullYear()}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink"
          required
        />
      </label>
      <label>
        <div className="text-[12px] font-bold text-ink-soft mb-1">Term</div>
        <select
          name="termNumber"
          defaultValue={existing?.termNumber ?? 1}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              Term {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        <div className="text-[12px] font-bold text-ink-soft mb-1">Start</div>
        <input
          name="startDate"
          type="date"
          defaultValue={existing?.startDate ?? ""}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink"
          required
        />
      </label>
      <label>
        <div className="text-[12px] font-bold text-ink-soft mb-1">End</div>
        <input
          name="endDate"
          type="date"
          defaultValue={existing?.endDate ?? ""}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink"
          required
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save" : "Add"}
        </Button>
        {existing && (
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (
                confirm(
                  "Delete this term? Curriculum rows referencing it will cascade.",
                )
              ) {
                startTransition(async () => {
                  const res = await deleteTerm(existing.id);
                  if (!res.ok) setError(res.error);
                });
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>
      {error && (
        <div className="col-span-full text-[13px] font-semibold text-bad">{error}</div>
      )}
    </form>
  );
}
