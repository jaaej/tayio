import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "brand" | "outline" | "ghost";

const VARIANT: Record<Variant, string> = {
  brand: "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_8px_24px_-12px_rgba(31,40,90,0.5)]",
  outline: "border border-line-strong bg-card text-ink hover:border-ink/40",
  ghost: "text-ink-soft hover:bg-surface-2 hover:text-ink",
};

/** A Link styled as a reference `.btn`, for page-head actions / CTAs. */
export function BtnLink({
  href,
  variant = "outline",
  children,
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-bold rounded-lg transition-colors ${VARIANT[variant]}`}
    >
      {children}
    </Link>
  );
}
