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
        "group relative block rounded-2xl border p-5 overflow-hidden transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-18px_rgba(29,41,81,0.32)]",
        className,
      )}
      style={{
        background: `linear-gradient(140deg, ${tokens.bgFrom} 0%, ${tokens.bgTo} 100%)`,
        borderColor: tokens.ring,
      }}
    >
      <div className="flex items-start justify-between gap-3 min-h-[64px]">
        <div className="min-w-0">
          <div
            className="text-lg font-semibold leading-tight tracking-tight"
            style={{ color: tokens.title }}
          >
            {subject}
          </div>
          {meta && (
            <div
              className="mt-1 text-xs truncate"
              style={{ color: tokens.meta }}
            >
              {meta}
            </div>
          )}
        </div>
        {badge && (
          <span
            className={cn(
              "shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.14em] font-semibold whitespace-nowrap",
              badge.tone === "warn"
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : badge.tone === "success"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-white/70 text-ink-soft border border-hairline/40",
            )}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div
        className="mt-5 flex items-center justify-between text-xs"
        style={{ color: tokens.meta }}
      >
        <span className="uppercase tracking-[0.16em] font-medium">
          View subject
        </span>
        <span
          className="text-base transition-transform group-hover:translate-x-0.5"
          style={{ color: tokens.arrow }}
        >
          →
        </span>
      </div>
    </Link>
  );
}
