import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Student-portal Card (v2 design). White surface, hairline border, subtle
 * shadow. Compose with CardHead + CardBody for the standard sectioned look.
 *
 * Kept separate from the shared @/components/ui/card so the older portals
 * (parent/tutor/admin) continue rendering with their own card style.
 */
export function Card({
  className,
  flat,
  accent,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  flat?: boolean;
  /** When set, renders a coloured top accent stripe (e.g. "var(--sky)"). */
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-line bg-surface",
        accent && "relative overflow-hidden",
        // Default cards share the admin/parent elevation so a card looks the
        // same across all four roles; `flat` still opts a card out.
        flat
          ? ""
          : "shadow-[0_1px_2px_rgba(15,17,30,0.05),0_8px_24px_-12px_rgba(31,40,90,0.10)]",
        className,
      )}
      {...props}
    >
      {accent && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: accent }}
        />
      )}
      {children}
    </div>
  );
}

export function CardHead({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3.5 border-b border-line",
        className,
      )}
    >
      <h3 className="text-[14px] font-bold text-ink m-0">{title}</h3>
      {action && (
        <div className="text-[12px] text-brand-600 font-semibold">{action}</div>
      )}
    </div>
  );
}

export function CardBody({
  className,
  tight,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tight?: boolean }) {
  return (
    <div className={cn(tight ? "p-0" : "p-4", className)} {...props} />
  );
}

export function CardLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[11px] uppercase tracking-[0.08em] text-muted font-bold",
        className,
      )}
    >
      {children}
    </div>
  );
}
