import { cn } from "@/lib/utils";

/**
 * Tiny pill for a status. Pair with style/label maps from src/lib/status.ts:
 *   <StatusBadge
 *     label={HOMEWORK_STATUS_LABEL[status]}
 *     className={HOMEWORK_STATUS_STYLE[status]}
 *   />
 */
export function StatusBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  );
}
