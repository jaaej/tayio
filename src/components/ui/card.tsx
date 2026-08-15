import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared card used by cross-role surfaces (discussions, resources, messages).
 * Reskinned 2026-08-03 to the canonical v2 look (14px radius, line border,
 * surface bg, the admin/parent depth shadow) so these surfaces match the
 * per-role v2 card kits. Padding stays p-6 here (these consumers rely on the
 * built-in padding); the per-role kits split padding into CardBody.
 */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-line bg-surface p-6 transition-colors shadow-[0_1px_2px_rgba(15,17,30,0.05),0_8px_24px_-12px_rgba(31,40,90,0.10)]",
        className,
      )}
      {...props}
    />
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
        "text-sm uppercase tracking-[0.14em] text-ink font-semibold",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h3 className={cn("text-lg text-ink mt-2", className)}>{children}</h3>;
}
