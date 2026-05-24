import { cn } from "@/lib/utils";

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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        className,
      )}
    >
      {label}
    </span>
  );
}
