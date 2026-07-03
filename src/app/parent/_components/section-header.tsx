import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({
  title,
  description,
  right,
  link,
}: {
  title: string;
  description?: string;
  right?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[14px] font-bold text-ink truncate">{title}</h2>
        {description && (
          <p className="text-[13px] text-muted mt-0.5">{description}</p>
        )}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-3 py-1.5 text-xs font-bold hover:bg-brand-100 transition-colors"
        >
          {link.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : right ? (
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted font-bold shrink-0">
          {right}
        </span>
      ) : null}
    </div>
  );
}
