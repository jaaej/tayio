import Link from "next/link";
import type { ReactNode } from "react";

type Accent = "brand" | "warn" | "success" | "muted";

const ACCENT_CLASS: Record<Accent, string> = {
  brand: "text-brand-700",
  warn: "text-amber-700",
  success: "text-emerald-700",
  muted: "text-ink",
};

const BORDER_CLASS: Record<Accent, string> = {
  brand: "border-hairline/50",
  warn: "border-amber-200/70",
  success: "border-emerald-200/60",
  muted: "border-hairline/50",
};

/**
 * Compact dashboard tile: label / big number / optional sub.
 * Optional href makes the whole tile a Link with a brand-tinted hover.
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
  const hoverClass = href
    ? "hover:border-brand-400 hover:shadow-[0_10px_24px_-14px_rgba(29,41,81,0.22)] cursor-pointer"
    : "hover:shadow-[0_8px_20px_-14px_rgba(29,41,81,0.18)]";

  const body = (
    <>
      <div className="text-[12px] uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div
        className={`mt-2 text-4xl font-medium tabular-nums truncate ${ACCENT_CLASS[accent]}`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[14px] text-muted truncate mt-1">{sub}</div>
      )}
    </>
  );

  const className = `rounded-xl border bg-card px-6 py-6 transition-all ${BORDER_CLASS[accent]} ${hoverClass}`;

  if (href) {
    return (
      <Link href={href} className={`block ${className}`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
