import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ActionSpinner } from "@/components/ui/loading-button";

/**
 * Admin button (glass redesign). Variant/size names stay compatible with the
 * shared `@/components/ui/button` so usages can be swapped 1:1.
 *
 * - primary / brand: ink fill, the one main action on a surface.
 * - glass: translucent fill for buttons sitting directly on a glass frame or
 *   page header.
 * - outline: white with a hairline border, for buttons on a white panel.
 * - ghost: no chrome until hover.
 *
 * Sizes: sm (30px) in table rows, md (36px) in section headers, lg (42px) in
 * page headers. `buttonVariants` styles links the same way.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 font-bold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white border border-ink hover:bg-[#2b2847]",
        brand: "bg-ink text-white border border-ink hover:bg-[#2b2847]",
        glass: "bg-white/65 text-ink border border-white/95 hover:bg-white",
        outline: "bg-surface text-ink border border-line-strong hover:bg-surface-2",
        ghost: "bg-transparent text-ink-soft border border-transparent hover:bg-surface-2 hover:text-ink",
        danger: "bg-bad-bg text-bad border border-transparent hover:brightness-95",
        link: "text-brand-600 underline-offset-4 hover:underline hover:text-brand-700",
      },
      size: {
        sm: "h-[30px] px-2.5 text-[12px] rounded-[9px]",
        md: "h-9 px-3.5 text-[13px] rounded-[10px]",
        lg: "h-[42px] px-4 text-[14px] rounded-[12px]",
        icon: "h-9 w-9 rounded-[10px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

const button = buttonVariants;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

function pendingText(children: React.ReactNode) {
  const text = React.Children.toArray(children)
    .filter((child): child is string => typeof child === "string")
    .join(" ")
    .trim();
  return /(?:…|\.\.\.)$/.test(text) ? text : null;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, disabled, ...props }, ref) => {
    const loadingLabel = disabled ? pendingText(children) : null;
    return (
      <button
        ref={ref}
        className={cn(button({ variant, size }), className)}
        disabled={disabled}
        aria-busy={loadingLabel ? true : props["aria-busy"]}
        {...props}
      >
        {loadingLabel ? (
          <>
            <ActionSpinner />
            {loadingLabel}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = "AdminButton";
