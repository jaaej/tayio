import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Accent = "brand" | "warn" | "success" | "muted" | "sun" | "info";

const VALUE_TONE: Record<Accent, string> = {
  brand:   "text-ink",
  warn:    "text-warn",
  success: "text-good",
  muted:   "text-ink",
  sun:     "text-sun-600",
  info:    "text-info",
};

const SUB_TONE: Record<Accent, string> = {
  brand:   "text-muted",
  warn:    "text-warn",
  success: "text-good",
  muted:   "text-muted",
  sun:     "text-muted",
  info:    "text-muted",
};

/**
 * Student-portal KPI tile (v2 design): uppercase label / big number / sub.
 * Kept separate from the shared @/components/data/stat-tile.
 */
export function StatTile({
  label,
  value,
  sub,
  accent = "brand",
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: Accent;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted font-bold">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-[26px] font-extrabold tracking-[-0.02em] tabular-nums leading-none",
          VALUE_TONE[accent],
        )}
      >
        {value}
      </div>
      {sub && (
        <div className={cn("text-[11px] mt-1.5 font-semibold", SUB_TONE[accent])}>
          {sub}
        </div>
      )}
    </>
  );

  const className = cn(
    "rounded-[14px] border border-line bg-surface p-4 shadow-[0_1px_0_rgba(15,17,30,0.04),0_1px_2px_rgba(15,17,30,0.04)] transition-colors",
    href && "hover:border-brand-300 cursor-pointer",
  );

  if (href) {
    return (
      <Link href={href} className={cn("block", className)}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
