import Link from "next/link";
import { cn } from "@/lib/utils";

export function SubjectCard({
  href,
  subject,
  meta,
  accent,
  badge,
  className,
}: {
  href: string;
  subject: string;
  meta?: string;
  /** CSS color for the left rail (any valid CSS color string) */
  accent?: string;
  badge?: { label: string; tone?: "default" | "warn" | "success" };
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative block bg-card rounded-2xl border border-hairline/50 p-5 pl-6",
        "shadow-[0_1px_2px_rgba(29,41,81,0.03),0_10px_28px_-20px_rgba(29,41,81,0.18)]",
        "hover:border-brand-400 hover:shadow-[0_1px_2px_rgba(29,41,81,0.04),0_16px_36px_-20px_rgba(29,41,81,0.28)]",
        "transition-all duration-200",
        className,
      )}
    >
      <div
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
        style={{ background: accent ?? "var(--periwinkle-400)" }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base text-ink font-medium leading-tight">
            {subject}
          </div>
          {meta && (
            <div className="mt-1 text-xs text-muted truncate">{meta}</div>
          )}
        </div>
        {badge && (
          <span
            className={cn(
              "shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.14em] font-medium",
              badge.tone === "warn"
                ? "bg-amber-50 text-amber-700"
                : badge.tone === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-brand-50 text-brand-700",
            )}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div className="mt-6 flex items-center justify-between text-xs">
        <span className="text-muted">View subject</span>
        <span className="text-brand-700 group-hover:translate-x-0.5 transition-transform">
          →
        </span>
      </div>
    </Link>
  );
}
