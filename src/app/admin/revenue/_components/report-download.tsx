"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

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
  "h-[42px] w-full rounded-[11px] border border-line-field bg-surface px-2.5 text-[14px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";
const LABEL = "flex min-w-0 flex-1 basis-full flex-col gap-1.5 text-[13px] font-bold text-ink";
const DATE_LABEL = "flex min-w-[140px] flex-1 flex-col gap-1.5 text-[13px] font-bold text-ink";

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
    <div className="flex flex-wrap gap-3">
      <label className={LABEL}>
        Period
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
        <label className={LABEL}>
          Term
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
          <label className={DATE_LABEL}>
            From
            <input
              type="date"
              className={INPUT}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className={DATE_LABEL}>
            To
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
          className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}
        >
          <Download className="h-4 w-4" aria-hidden />
          Download PDF
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded-[12px] bg-surface-2 px-4 text-[14px] font-bold text-muted"
        >
          <Download className="h-4 w-4" aria-hidden />
          {invalid ? "Check dates" : "Download PDF"}
        </span>
      )}
    </div>
  );
}
