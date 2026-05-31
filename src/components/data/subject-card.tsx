import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  type AccentFamily,
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";

export type { AccentFamily } from "@/lib/subject-colors";
export { colorFamilyForSubject } from "@/lib/subject-colors";

export function SubjectCard({
  href,
  subject,
  meta,
  family,
  accent: _accent, // back-compat: ignored, family is derived from subject name
  badge,
  className,
}: {
  href: string;
  subject: string;
  meta?: string;
  family?: AccentFamily;
  /** @deprecated use `family` */
  accent?: string;
  badge?: { label: string; tone?: "default" | "warn" | "success" };
  className?: string;
}) {
  const tokens = getAccentTokens(family ?? colorFamilyForSubject(subject));

  return (
    <Link
      href={href}
      className={cn(
        "group relative block rounded-xl border-2 p-4 overflow-hidden transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(29,41,81,0.35)]",
        className,
      )}
      style={{
        backgroundColor: tokens.pillBg,
        borderColor: tokens.ring,
      }}
    >
      <div className="flex items-start justify-between gap-2 min-h-[48px]">
        <div className="min-w-0">
          <div
            className="text-lg font-bold leading-tight tracking-tight"
            style={{ color: tokens.pillText }}
          >
            {subject}
          </div>
          {meta && (
            <div
              className="mt-1 text-xs truncate font-medium"
              style={{ color: tokens.pillText, opacity: 0.8 }}
            >
              {meta}
            </div>
          )}
        </div>
        {badge && (
          <span
            className={cn(
              "shrink-0 inline-flex items-center px-2 py-1 rounded-full text-[10px] uppercase tracking-[0.14em] font-bold whitespace-nowrap",
              badge.tone === "warn"
                ? "bg-white/80 text-amber-900 border border-amber-300"
                : badge.tone === "success"
                  ? "bg-white/80 text-emerald-900 border border-emerald-300"
                  : "bg-white/80 text-ink border border-hairline/40",
            )}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div
        className="mt-3 flex items-center justify-between text-xs font-semibold"
        style={{ color: tokens.pillText }}
      >
        <span className="uppercase tracking-[0.14em]">View subject</span>
        <span
          className="text-base transition-transform group-hover:translate-x-0.5"
          style={{ color: tokens.pillText }}
        >
          →
        </span>
      </div>
    </Link>
  );
}
