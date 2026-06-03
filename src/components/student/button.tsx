import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Student-portal Button (v2 design). Pill-cornered, weight 700.
 * Kept separate from the shared @/components/ui/button.
 */
const button = cva(
  "inline-flex items-center justify-center gap-1.5 font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap rounded-[8px]",
  {
    variants: {
      variant: {
        default:
          "bg-surface text-ink border border-line-strong hover:bg-surface-2",
        primary:
          "bg-brand-500 text-white border border-brand-500 hover:bg-brand-600 hover:border-brand-600",
        sun:
          "bg-sun-500 text-white border border-sun-500 hover:bg-sun-600 hover:border-sun-600",
        ghost:
          "bg-transparent text-muted border border-transparent hover:bg-surface-2 hover:text-ink",
        danger:
          "bg-bad-bg text-bad border border-transparent hover:opacity-90",
        link:
          "bg-transparent text-brand-600 border border-transparent hover:underline underline-offset-4",
      },
      size: {
        sm: "h-8 px-[10px] text-[12px]",
        md: "h-9 px-3.5 text-[13px]",
        lg: "h-11 px-5 text-[14px]",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
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
Button.displayName = "Button";
