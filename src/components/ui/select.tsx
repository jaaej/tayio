import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-11 w-full rounded-[10px] border border-line-field bg-card px-3 text-sm text-ink",
      "transition-colors appearance-none",
      "focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
