import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[96px] w-full rounded-xl border border-hairline/60 bg-card px-4 py-3 text-sm text-ink",
      "placeholder:text-muted/70 transition-colors resize-y",
      "focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
