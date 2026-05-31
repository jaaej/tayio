"use client";

import Link from "next/link";
import type { SubjectWeek, Term } from "@/db/schema";
import { cn } from "@/lib/utils";

export function WeekStripAdmin({
  subjectId,
  weeks,
  terms,
  currentTermId,
  selectedWeekId,
}: {
  subjectId: string;
  weeks: SubjectWeek[];
  terms: Term[];
  currentTermId: string;
  selectedWeekId: string | null;
}) {
  const base = `/admin/subjects/${subjectId}/curriculum`;

  return (
    <aside className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-2">
          Term
        </div>
        <select
          defaultValue={currentTermId}
          onChange={(e) => {
            window.location.href = `${base}?term=${e.target.value}`;
          }}
          className="w-full rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink"
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.year} · Term {t.termNumber}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2.5">
        {weeks.map((w) => {
          const isActive = w.id === selectedWeekId;
          return (
            <Link
              key={w.id}
              href={`${base}?term=${currentTermId}&week=${w.id}`}
              className={cn(
                "block rounded-2xl border-2 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(29,41,81,0.32)]",
                isActive
                  ? "border-brand-600 bg-gradient-to-br from-brand-200 via-brand-100 to-brand-50 shadow-[0_8px_24px_-12px_rgba(29,41,81,0.4)]"
                  : "border-hairline/60 bg-card hover:border-brand-300",
              )}
            >
              <div
                className={cn(
                  "text-[10px] uppercase tracking-[0.18em] font-semibold",
                  isActive ? "text-brand-700" : "text-muted",
                )}
              >
                Week {w.weekNumber}
              </div>
              <div className="mt-1 text-sm font-medium leading-tight text-ink line-clamp-2">
                {w.title}
              </div>
            </Link>
          );
        })}
        <Link
          href={`${base}?term=${currentTermId}&new=1`}
          className="block rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/40 px-4 py-3 text-center text-sm font-semibold text-brand-700 hover:bg-brand-100 hover:border-brand-400 transition-colors"
        >
          + Add week
        </Link>
      </div>
    </aside>
  );
}
