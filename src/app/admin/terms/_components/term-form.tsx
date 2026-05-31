"use client";

import { useState, useTransition } from "react";
import {
  createTerm,
  updateTerm,
  deleteTerm,
} from "@/app/admin/_lib/actions-terms";
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
      <label className="text-sm">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">Year</div>
        <input
          name="year"
          type="number"
          defaultValue={existing?.year ?? new Date().getFullYear()}
          className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
          required
        />
      </label>
      <label className="text-sm">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">Term</div>
        <select
          name="termNumber"
          defaultValue={existing?.termNumber ?? 1}
          className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              Term {n}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">Start</div>
        <input
          name="startDate"
          type="date"
          defaultValue={existing?.startDate ?? ""}
          className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
          required
        />
      </label>
      <label className="text-sm">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">End</div>
        <input
          name="endDate"
          type="date"
          defaultValue={existing?.endDate ?? ""}
          className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
          required
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : existing ? "Save" : "Add"}
        </button>
        {existing && (
          <button
            type="button"
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
            className="rounded-md border border-red-300 text-red-700 px-3 py-2 text-sm"
          >
            Delete
          </button>
        )}
      </div>
      {error && (
        <div className="col-span-full text-sm text-red-700">{error}</div>
      )}
    </form>
  );
}
