"use client";

import Link from "next/link";

export function WeekSidebarParent({
  subjectId,
  childId,
  termsAvailable,
  currentTermId,
  weeks,
  selectedWeekId,
}: {
  subjectId: string;
  childId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  currentTermId: string;
  weeks: Array<{ subjectWeekId: string; weekNumber: number; title: string }>;
  selectedWeekId: string | null;
}) {
  const base = `/parent/subjects/${subjectId}`;

  return (
    <aside className="space-y-3">
      <label className="block text-xs uppercase tracking-wide text-muted">
        Term
      </label>
      <select
        defaultValue={currentTermId}
        onChange={(e) => {
          window.location.href = `${base}?child=${childId}&term=${e.target.value}`;
        }}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
      >
        {termsAvailable.map((t) => (
          <option key={t.id} value={t.id}>
            {t.year} · Term {t.termNumber}
          </option>
        ))}
      </select>

      <nav className="space-y-1">
        {weeks.map((w) => {
          const isActive = w.subjectWeekId === selectedWeekId;
          return (
            <Link
              key={w.subjectWeekId}
              href={`${base}?child=${childId}&term=${currentTermId}&week=${w.subjectWeekId}`}
              className={
                "block rounded-md px-3 py-2 text-sm transition-colors " +
                (isActive
                  ? "bg-brand-100 text-ink font-medium"
                  : "text-ink-soft hover:bg-brand-50")
              }
            >
              Week {w.weekNumber} · {w.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
