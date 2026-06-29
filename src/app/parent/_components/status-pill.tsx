/**
 * Reference status pill: a small rounded chip with a leading dot and a
 * bold label. Reuses the shared `@/lib/status` colour classes (e.g.
 * "bg-emerald-100 text-emerald-900") so semantics stay consistent across
 * portals; the dot inherits the text colour.
 */
export function StatusPill({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${
        className ?? "bg-surface-2 text-ink-soft"
      }`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
      />
      {label}
    </span>
  );
}
