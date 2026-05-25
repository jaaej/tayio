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
        <div className="text-xl font-medium text-ink">{title}</div>
        {description && (
          <div className="text-xs text-muted mt-1">{description}</div>
        )}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="text-sm text-brand-700 hover:underline shrink-0"
        >
          {link.label} →
        </Link>
      ) : right ? (
        <span className="text-sm uppercase tracking-[0.18em] text-muted shrink-0">
          {right}
        </span>
      ) : null}
    </div>
  );
}
