"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Month = { key: string; label: string; total: number };

function compact(n: number) {
  if (n >= 1000) {
    const k = n / 1000;
    return `$${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return `$${Math.round(n)}`;
}

function full(n: number) {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

/**
 * Six months of collected revenue. One series, so no legend: every bar is
 * direct-labelled, the current month is emphasised in ink, and a table copy
 * serves screen readers.
 */
export function RevenueBars({ months }: { months: Month[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...months.map((m) => m.total), 1);
  const last = months.length - 1;

  return (
    <div>
      <div className="relative flex h-[180px] items-end gap-2" aria-hidden>
        {months.map((m, i) => {
          const pct = (m.total / max) * 100;
          return (
            <div
              key={m.key}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="mb-1.5 text-[11px] font-extrabold tabular-nums text-muted">
                {compact(m.total)}
              </span>
              <div
                className={cn(
                  "w-full max-w-[36px] rounded-t-[8px] transition-colors",
                  i === last
                    ? "bg-ink"
                    : hover === i
                      ? "bg-[#AEB1E6]"
                      : "bg-[#C9CBEE]",
                )}
                style={{ height: `${Math.max(pct, m.total > 0 ? 2 : 0)}%` }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-ink px-2 py-1 text-[11px] font-bold text-white shadow-lg">
                  {m.label} · {full(m.total)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line pt-2" aria-hidden>
        {months.map((m, i) => (
          <span
            key={m.key}
            className={cn(
              "flex-1 text-center text-[12px] font-bold",
              i === last ? "text-ink" : "text-muted",
            )}
          >
            {m.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Revenue collected per month</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}>
              <th scope="row">{m.label}</th>
              <td>{full(m.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
