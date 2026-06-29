import type { ReactNode } from "react";

type Delta = "up" | "down" | "flat";

const DELTA_CLASS: Record<Delta, string> = {
  up: "text-good",
  down: "text-bad",
  flat: "text-muted",
};

/**
 * Reference KPI tile: uppercase label, big extrabold value, optional
 * sub-line whose colour reflects an up/down/flat trend. Mirrors the
 * reference `.kpi` card.
 */
export function Kpi({
  label,
  value,
  sub,
  delta = "flat",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  delta?: Delta;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-card px-4 py-4 shadow-[0_1px_2px_rgba(15,17,30,0.04),0_8px_24px_-16px_rgba(31,40,90,0.10)]">
      <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted">
        {label}
      </div>
      <div className="mt-1.5 text-[26px] font-extrabold tracking-[-0.02em] text-ink tabular-nums leading-none truncate">
        {value}
      </div>
      {sub && (
        <div className={`mt-2 text-xs font-semibold ${DELTA_CLASS[delta]}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
