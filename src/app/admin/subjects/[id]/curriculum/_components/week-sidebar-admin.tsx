"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SubjectWeek, Term } from "@/db/schema";

export function WeekSidebarAdmin({
  weeks,
  terms,
  currentTermId,
  subjectId,
}: {
  weeks: SubjectWeek[];
  terms: Term[];
  currentTermId: string;
  subjectId: string;
}) {
  const params = useSearchParams();
  const selectedWeek = params.get("week");

  return (
    <aside className="space-y-3">
      <label className="block text-xs uppercase tracking-wide text-muted">
        Term
      </label>
      <select
        defaultValue={currentTermId}
        onChange={(e) => {
          window.location.href = `/admin/subjects/${subjectId}/curriculum?term=${e.target.value}`;
        }}
        className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2 text-sm"
      >
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.year} · Term {t.termNumber}
          </option>
        ))}
      </select>

      <div className="space-y-1">
        {weeks.map((w) => (
          <Link
            key={w.id}
            href={`/admin/subjects/${subjectId}/curriculum?term=${currentTermId}&week=${w.id}`}
            className={
              "block rounded-md px-3 py-2 text-sm " +
              (selectedWeek === w.id
                ? "bg-brand-100 text-ink font-medium"
                : "text-ink-soft hover:bg-brand-50")
            }
          >
            Week {w.weekNumber} · {w.title}
          </Link>
        ))}
        <Link
          href={`/admin/subjects/${subjectId}/curriculum?term=${currentTermId}&new=1`}
          className="block rounded-md px-3 py-2 text-sm text-brand-700 border border-dashed border-brand-300 hover:bg-brand-50"
        >
          + Add week
        </Link>
      </div>
    </aside>
  );
}
