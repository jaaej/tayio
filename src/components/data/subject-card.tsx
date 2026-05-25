import Link from "next/link";
import { cn } from "@/lib/utils";

export type AccentFamily =
  | "periwinkle"
  | "amber"
  | "emerald"
  | "rose"
  | "violet"
  | "cyan";

type AccentTokens = {
  rail: string;
  bgFrom: string;
  bgTo: string;
  ring: string;
  title: string;
  meta: string;
};

const ACCENT_TOKENS: Record<AccentFamily, AccentTokens> = {
  periwinkle: {
    rail: "#5e7bc7",
    bgFrom: "rgba(94, 123, 199, 0.18)",
    bgTo: "rgba(94, 123, 199, 0.05)",
    ring: "rgba(94, 123, 199, 0.4)",
    title: "#2e3a6b",
    meta: "rgba(46, 58, 107, 0.7)",
  },
  amber: {
    rail: "#d97706",
    bgFrom: "rgba(217, 119, 6, 0.16)",
    bgTo: "rgba(217, 119, 6, 0.04)",
    ring: "rgba(217, 119, 6, 0.4)",
    title: "#92400e",
    meta: "rgba(146, 64, 14, 0.75)",
  },
  emerald: {
    rail: "#059669",
    bgFrom: "rgba(5, 150, 105, 0.16)",
    bgTo: "rgba(5, 150, 105, 0.04)",
    ring: "rgba(5, 150, 105, 0.4)",
    title: "#065f46",
    meta: "rgba(6, 95, 70, 0.75)",
  },
  rose: {
    rail: "#e11d48",
    bgFrom: "rgba(225, 29, 72, 0.14)",
    bgTo: "rgba(225, 29, 72, 0.03)",
    ring: "rgba(225, 29, 72, 0.4)",
    title: "#9f1239",
    meta: "rgba(159, 18, 57, 0.75)",
  },
  violet: {
    rail: "#7c3aed",
    bgFrom: "rgba(124, 58, 237, 0.16)",
    bgTo: "rgba(124, 58, 237, 0.04)",
    ring: "rgba(124, 58, 237, 0.4)",
    title: "#5b21b6",
    meta: "rgba(91, 33, 182, 0.75)",
  },
  cyan: {
    rail: "#0891b2",
    bgFrom: "rgba(8, 145, 178, 0.16)",
    bgTo: "rgba(8, 145, 178, 0.04)",
    ring: "rgba(8, 145, 178, 0.4)",
    title: "#155e75",
    meta: "rgba(21, 94, 117, 0.8)",
  },
};

/**
 * Map a subject name to a colour family. Heuristic by name so new
 * subjects pick a reasonable family without needing a registry.
 */
export function colorFamilyForSubject(name: string): AccentFamily {
  const n = name.toLowerCase();
  if (n.includes("english") || n.includes("literature")) return "amber";
  if (n.includes("physics")) return "violet";
  if (n.includes("chemistry") || n.includes("chem")) return "emerald";
  if (n.includes("biology") || n.includes("bio")) return "rose";
  if (n.includes("history") || n.includes("geo") || n.includes("legal"))
    return "cyan";
  // Math / Methods / Specialist / default → periwinkle (brand)
  return "periwinkle";
}

export function SubjectCard({
  href,
  subject,
  meta,
  family,
  accent: _accent, // back-compat: ignored now, family derived from subject name
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
  const tokens = ACCENT_TOKENS[family ?? colorFamilyForSubject(subject)];

  return (
    <Link
      href={href}
      className={cn(
        "group relative block rounded-2xl border p-5 pl-6 overflow-hidden transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-18px_rgba(29,41,81,0.32)]",
        className,
      )}
      style={{
        background: `linear-gradient(140deg, ${tokens.bgFrom} 0%, ${tokens.bgTo} 100%)`,
        borderColor: tokens.ring,
      }}
    >
      <span
        className="absolute left-0 top-3 bottom-3 w-[5px] rounded-r-full"
        style={{ background: tokens.rail }}
        aria-hidden
      />
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
          style={{ color: tokens.rail }}
        >
          →
        </span>
      </div>
    </Link>
  );
}
