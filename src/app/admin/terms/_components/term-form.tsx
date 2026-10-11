"use client";

import { useState, useTransition } from "react";
import {
  createTerm,
  updateTerm,
  deleteTerm,
} from "@/app/admin/_lib/actions-terms";
import { Button } from "@/components/admin/ui";
import type { Term } from "@/db/schema";

const FIELD =
  "h-10 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-2.5 text-[14px] text-ink transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

const LABEL = "flex min-w-0 flex-col gap-1.5 text-[13px] font-bold text-ink";

/** "Add a term" form: year, term number, dates. */
export function TermForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createTerm(formData);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <form
      action={submit}
      className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[110px_140px_minmax(0,1fr)_minmax(0,1fr)_auto]"
    >
      <label className={LABEL}>
        Year
        <input
          name="year"
          type="number"
          min={2020}
          max={2100}
          defaultValue={new Date().getFullYear()}
          className={FIELD}
          required
        />
      </label>
      <label className={LABEL}>
        Term
        <TermSelect />
      </label>
      <label className={LABEL}>
        Starts
        <input name="startDate" type="date" className={FIELD} required />
      </label>
      <label className={LABEL}>
        Ends
        <input name="endDate" type="date" className={FIELD} required />
      </label>
      <Button
        type="submit"
        disabled={pending}
        className="col-span-2 h-10 lg:col-span-1"
      >
        {pending ? "Adding…" : "Add term"}
      </Button>
      {error && (
        <p role="alert" className="col-span-full text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * One existing term as an editable row. Year and term number stay editable:
 * fixing a typo here is the only correction path that does not cost the
 * curriculum weeks a delete would cascade to.
 */
export function TermRow({ term, isCurrent }: { term: Term; isCurrent: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = `${term.year} Term ${term.termNumber}`;

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateTerm(term.id, formData);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    if (
      !confirm(
        `Delete ${label}? The curriculum weeks attached to it are deleted too.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteTerm(term.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <form
      action={submit}
      aria-label={label}
      className="grid grid-cols-2 items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2/60 lg:grid-cols-[88px_120px_minmax(0,1fr)_minmax(0,1fr)_200px]"
    >
      <input
        name="year"
        type="number"
        min={2020}
        max={2100}
        defaultValue={term.year}
        aria-label={`${label} year`}
        className={`${FIELD} font-extrabold`}
        required
      />
      <TermSelect defaultValue={term.termNumber} ariaLabel={`${label} term`} />
      <input
        name="startDate"
        type="date"
        defaultValue={term.startDate}
        aria-label={`${label} start`}
        className={FIELD}
        required
      />
      <input
        name="endDate"
        type="date"
        defaultValue={term.endDate}
        aria-label={`${label} end`}
        className={FIELD}
        required
      />
      <div className="col-span-2 flex items-center gap-1.5 lg:col-span-1 lg:justify-end">
        {isCurrent && (
          <span className="mr-1 inline-flex h-5 items-center rounded-full bg-ink px-2 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white">
            Now
          </span>
        )}
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="danger" disabled={pending} onClick={remove}>
          Delete
        </Button>
      </div>
      {error && (
        <p role="alert" className="col-span-full text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
    </form>
  );
}

function TermSelect({
  defaultValue = 1,
  ariaLabel,
}: {
  defaultValue?: number;
  ariaLabel?: string;
}) {
  return (
    <select
      name="termNumber"
      defaultValue={defaultValue}
      aria-label={ariaLabel}
      className={FIELD}
    >
      {[1, 2, 3, 4].map((n) => (
        <option key={n} value={n}>
          Term {n}
        </option>
      ))}
    </select>
  );
}
