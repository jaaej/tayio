import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Parent button - the reference `.btn`. Variant/size names are kept compatible
 * with the shared `@/components/ui/button` so usages can be swapped 1:1.
 */
const button = cva(
  "inline-flex items-center justify-center gap-1.5 font-bold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-brand-500 text-white border border-brand-500 hover:bg-brand-600 hover:border-brand-600",
        brand: "bg-brand-500 text-white border border-brand-500 hover:bg-brand-600 hover:border-brand-600",
        outline: "bg-surface text-ink border border-line-strong hover:bg-surface-2",
        ghost: "bg-transparent text-muted border border-transparent hover:bg-surface-2 hover:text-ink",
        danger: "bg-bad-bg text-bad border border-transparent hover:brightness-95",
        link: "text-brand-600 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[12px] rounded-full",
        md: "h-9 px-4 text-[13px] rounded-full",
        lg: "h-11 px-5 text-sm rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "ParentButton";
