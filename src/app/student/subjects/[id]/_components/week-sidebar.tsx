"use client";

import Link from "next/link";

export function WeekSidebar({
  subjectId,
  termsAvailable,
  currentTermId,
  weeks,
  currentWeekIdHint,
  selectedWeekId,
}: {
  subjectId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  currentTermId: string;
  weeks: Array<{ subjectWeekId: string; weekNumber: number; title: string }>;
  currentWeekIdHint: string | null;
  selectedWeekId: string | null;
}) {
  const activeWeek =
    selectedWeekId ?? currentWeekIdHint ?? weeks[0]?.subjectWeekId;
  const baseHref = `/student/subjects/${subjectId}`;

  return (
    <aside className="space-y-3">
      <label className="block text-xs uppercase tracking-wide text-muted">
        Term
      </label>
      <select
        defaultValue={currentTermId}
        onChange={(e) => {
          window.location.href = `${baseHref}?term=${e.target.value}`;
        }}
        className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2 text-sm"
      >
        {termsAvailable.map((t) => (
          <option key={t.id} value={t.id}>
            {t.year} · Term {t.termNumber}
          </option>
        ))}
      </select>

      <nav className="space-y-1">
        {weeks.map((w) => {
          const isActive = w.subjectWeekId === activeWeek;
          return (
            <Link
              key={w.subjectWeekId}
              href={`${baseHref}?term=${currentTermId}&week=${w.subjectWeekId}`}
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
