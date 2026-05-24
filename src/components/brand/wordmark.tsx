import { cn } from "@/lib/utils";

/**
 * Taiyo wordmark. The "i" dot is replaced with a tiny sun disc —
 * a quiet reference to 太陽 (taiyo / sun). Used in nav + login.
 */
export function Wordmark({
  className,
  showTag = false,
}: {
  className?: string;
  showTag?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="text-xl tracking-tight text-ink font-medium leading-none">
        ta
        <span className="relative inline-block">
          <span aria-hidden className="relative">
            ı
          </span>
          <span
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 -top-[7px] block h-[7px] w-[7px] rounded-full bg-[var(--sun)]"
          />
        </span>
        yo
        <span className="text-muted/70"> portal</span>
      </span>
      {showTag && (
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
          taiyo tuition
        </span>
      )}
    </div>
  );
}
