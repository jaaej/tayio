import Link from "next/link";

/**
 * Card-head style block heading. Used inside <Card className="p-0">
 * blocks throughout the student portal so every callsite inherits the
 * new design without changing its props.
 */
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
    <div className="px-4 py-3.5 border-b border-line flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="m-0 text-[14px] font-bold text-ink">{title}</h3>
        {description && (
          <div className="text-[12px] text-muted mt-1 truncate">
            {description}
          </div>
        )}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="text-[12px] text-brand-600 hover:text-brand-700 font-semibold shrink-0"
        >
          {link.label} →
        </Link>
      ) : right ? (
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted font-bold shrink-0">
          {right}
        </span>
      ) : null}
    </div>
  );
}
