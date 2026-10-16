import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { subjectTone } from "@/lib/subject-tone";

/*
 * Small pieces of the admin glass redesign shared by every admin page.
 * Server-safe (no hooks): link-driven controls write their state to the URL.
 */

export type SegmentItem = {
  label: ReactNode;
  href: string;
  active: boolean;
  /** Optional count shown after the label. */
  count?: number;
  /** "warn" marks a count that needs action (a solid badge). */
  countTone?: "default" | "warn";
};

/**
 * Segmented control on glass: a translucent track with the selected option
 * filled in ink. Each option is a link, so the choice lives in the URL.
 * `size="md"` is the page-section variant (taller options, counts as badges),
 * used for tabs under a page header such as the tutor class page.
 */
export function SegmentedLinks({
  items,
  label,
  className,
  stretch = false,
  size = "sm",
}: {
  items: SegmentItem[];
  /** Accessible name for the group. */
  label: string;
  className?: string;
  /** Spread the options across the full width. */
  stretch?: boolean;
  size?: "sm" | "md";
}) {
  const md = size === "md";
  return (
    <nav
      aria-label={label}
      className={cn(
        "inline-flex gap-0.5 border border-white/90 bg-white/60 p-[3px]",
        md ? "rounded-[12px]" : "rounded-[11px]",
        stretch && "flex w-full",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
            md
              ? "h-[34px] gap-[7px] rounded-[9px] px-3.5 text-[13px]"
              : "h-7 gap-1.5 rounded-[8px] px-2.5 text-[12px]",
            stretch && "flex-1 px-1",
            item.active
              ? "bg-ink text-white"
              : "text-ink-soft hover:bg-white/80 hover:text-ink",
          )}
        >
          {item.label}
          {md && item.count !== undefined && item.count > 0 && (
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-[10px] px-1.5 text-[11px] font-extrabold tabular-nums",
                item.countTone === "warn"
                  ? "bg-warn text-white"
                  : item.active
                    ? "bg-white text-ink"
                    : "bg-surface-3 text-ink",
              )}
            >
              {item.count}
            </span>
          )}
          {!md && item.count !== undefined && (
            <span
              className={cn(
                "tabular-nums",
                item.active ? "text-white/75" : "text-muted",
              )}
            >
              {item.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Underlined tabs along the top of a white panel. Link-driven so each tab
 * has its own URL.
 */
export function TabLinks({
  items,
  label,
  className,
}: {
  items: SegmentItem[];
  label: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex gap-0.5 overflow-x-auto border-b border-line px-2 pt-2",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-[8px] border-b-2 px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
            item.active
              ? "border-ink font-extrabold text-ink"
              : "border-transparent font-semibold text-muted hover:text-ink",
          )}
        >
          {item.label}
          {item.count !== undefined && item.count > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-3 px-1.5 text-[11px] font-extrabold tabular-nums text-ink">
              {item.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

const AVATAR_TONE = {
  neutral: "bg-surface-3 text-ink",
  brand: "bg-brand-100 text-brand-600",
  ink: "bg-ink text-white",
} as const;

/** Round initials avatar. */
export function Avatar({
  name,
  size = 30,
  tone = "neutral",
  className,
}: {
  name: string;
  size?: number;
  tone?: keyof typeof AVATAR_TONE;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-extrabold",
        AVATAR_TONE[tone],
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Small rounded square in the subject's colour. */
export function SubjectDot({
  subject,
  color,
  className,
}: {
  subject: string;
  /** The subject's stored colour (`subjects.color`). */
  color: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-[9px] w-[9px] shrink-0 rounded-[3px]", className)}
      style={{ backgroundColor: subjectTone(subject, color).dot }}
    />
  );
}

/** Small glass tile with a label and a big number; optionally a filter link. */
export function MetricTile({
  label,
  value,
  sub,
  href,
  active,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  active?: boolean;
  tone?: "default" | "good" | "warn" | "bad";
  className?: string;
}) {
  const valueTone = {
    default: "text-ink",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
  }[tone];
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-0.5 rounded-[16px] px-3.5 py-3 transition-colors",
        active ? "bg-ink text-white" : "panel",
      )}
    >
      <span className={cn("text-[12px] font-bold", active ? "text-white/75" : "text-muted")}>
        {label}
      </span>
      <span
        className={cn(
          "text-[22px] font-extrabold leading-tight tabular-nums",
          active ? "text-white" : valueTone,
        )}
      >
        {value}
      </span>
      {sub && (
        <span className={cn("text-[12px]", active ? "text-white/75" : "text-muted")}>
          {sub}
        </span>
      )}
    </div>
  );
  return href ? (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "block rounded-[16px] transition-transform duration-150 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        className,
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
