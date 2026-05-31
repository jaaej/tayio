import Link from "next/link";

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
    <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xl font-medium text-ink uppercase tracking-wide">{title}</div>
        {description && (
          <div className="text-sm text-ink-soft mt-1">{description}</div>
        )}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm font-semibold hover:bg-brand-700 transition-colors"
        >
          {link.label} →
        </Link>
      ) : right ? (
        <span className="text-sm uppercase tracking-[0.18em] text-muted font-medium shrink-0">
          {right}
        </span>
      ) : null}
    </div>
  );
}
