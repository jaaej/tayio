import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline/60 bg-card p-6 transition-colors shadow-[0_1px_2px_rgba(29,41,81,0.04),0_8px_24px_-16px_rgba(29,41,81,0.18)]",
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
