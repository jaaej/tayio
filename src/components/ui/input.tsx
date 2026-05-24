import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-xl border border-hairline bg-surface px-4 text-sm text-ink",
      "placeholder:text-muted/70 transition-colors",
      "focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-[11px] uppercase tracking-[0.14em] text-muted font-medium",
        className,
      )}
    >
      {children}
    </label>
  );
}
