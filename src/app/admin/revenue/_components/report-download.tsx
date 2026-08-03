"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export type ReportTerm = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

type Mode = "this_month" | "last_month" | "term" | "custom";

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const INPUT =
  "h-9 rounded-[10px] border border-line bg-surface px-2.5 text-[13px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

export function RevenueReportDownload({ terms }: { terms: ReportTerm[] }) {
  const [mode, setMode] = useState<Mode>("this_month");
  const [termId, setTermId] = useState(terms[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function range(): { from: string; to: string } | null {
    const now = new Date();
    if (mode === "this_month") {
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    }
    if (mode === "last_month") {
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    }
    if (mode === "term") {
      const t = terms.find((x) => x.id === termId);
      return t ? { from: t.startDate, to: t.endDate } : null;
    }
    return from && to ? { from, to } : null;
  }

  const r = range();
  const href = r
    ? `/admin/revenue/report?from=${r.from}&to=${r.to}`
    : undefined;
  const invalid = mode === "custom" && from && to && to < from;

  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <label className="space-y-1">
        <span className="block text-[11px] font-bold text-muted">Period</span>
        <select
          className={INPUT}
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
        >
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          {terms.length > 0 && <option value="term">By term</option>}
          <option value="custom">Custom range</option>
        </select>
      </label>

      {mode === "term" && (
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-muted">Term</span>
          <select
            className={INPUT}
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {mode === "custom" && (
        <>
          <label className="space-y-1">
            <span className="block text-[11px] font-bold text-muted">From</span>
            <input
              type="date"
              className={INPUT}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] font-bold text-muted">To</span>
            <input
              type="date"
              className={INPUT}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </>
      )}

      {href && !invalid ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700"
        >
          <Download className="h-4 w-4" aria-hidden />
          Download PDF
        </a>
      ) : (
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-[12px] font-bold text-muted">
          <Download className="h-4 w-4" aria-hidden />
          {invalid ? "Check dates" : "Download PDF"}
        </span>
      )}
    </div>
  );
}
