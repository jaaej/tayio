import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-ink text-white hover:bg-brand-600 active:scale-[0.98] shadow-[0_1px_0_rgba(0,0,0,0.05),0_8px_24px_-12px_rgba(52,130,255,0.4)]",
        brand:
          "bg-brand-600 text-white hover:bg-brand-700 active:scale-[0.98] shadow-[0_1px_0_rgba(0,0,0,0.05),0_8px_24px_-12px_rgba(52,130,255,0.5)]",
        outline:
          "border border-hairline bg-surface text-ink hover:border-ink/40 hover:bg-surface-2",
        ghost: "text-ink hover:bg-surface-2",
        link: "text-brand-600 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-sm rounded-lg",
        md: "h-11 px-5 text-sm rounded-xl",
        lg: "h-12 px-6 text-base rounded-xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
