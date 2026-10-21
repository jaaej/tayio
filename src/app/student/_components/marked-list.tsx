"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ScoreBadge } from "@/components/data/score-badge";
import { formatDueDate } from "@/lib/format";
import type { HomeworkRow } from "@/app/student/_lib/queries";

export function MarkedList({ items }: { items: HomeworkRow[] }) {
  return (
    <ul className="divide-y divide-hairline/60 rounded-xl border border-hairline/60 bg-card overflow-hidden">
      {items.map((hw) => (
        <MarkedRow key={hw.homeworkId} hw={hw} />
      ))}
    </ul>
  );
}

function MarkedRow({ hw }: { hw: HomeworkRow }) {
  const [open, setOpen] = useState(false);
  const submittedLabel = hw.submittedAt
    ? hw.submittedAt.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted truncate">
            {hw.className ?? "Independent task"}
          </div>
          <div className="text-sm font-medium text-ink truncate">
            {hw.title}
          </div>
        </div>
        {hw.score && <ScoreBadge score={hw.score} />}
        <span className="text-[11px] uppercase tracking-[0.14em] tabular-nums text-ink-soft hidden sm:inline">
          Due {formatDueDate(hw.dueDate)}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 text-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 bg-brand-50/30 border-t border-hairline/60">
          {hw.feedback ? (
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium mb-1">
                Tutor feedback
              </div>
              <p className="text-sm text-ink whitespace-pre-wrap">
                {hw.feedback}
              </p>
            </div>
          ) : (
            <div className="text-sm text-ink-soft italic">
              No written feedback.
            </div>
          )}
          <div className="flex items-center justify-between gap-3 text-xs text-ink-soft">
            <span>
              {submittedLabel ? `Submitted ${submittedLabel}` : "-"}
            </span>
            <Link
              href={`/student/homework/${hw.homeworkId}`}
              className="inline-flex min-h-9 items-center rounded-[8px] px-1 text-xs uppercase tracking-[0.14em] font-medium text-brand-700 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
            >
              Open full →
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}
