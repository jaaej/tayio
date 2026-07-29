import { cn } from "@/lib/utils";

/**
 * Torii gate mark - recreated as inline SVG so it scales without an asset request.
 * Matches the navy torii in the Taiyo Tuition logo.
 */
export function ToriiMark({
  className,
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill={color}
      aria-hidden
    >
      {/* Top beam (kasagi) with upturned ends */}
      <path d="M4 14c4-3 8-4 12-4h32c4 0 8 1 12 4l-2 4c-4-2-8-3-12-3H18c-4 0-8 1-12 3l-2-4z" />
      {/* Shimaki - thick block under the top beam */}
      <rect x="8" y="18" width="48" height="6" rx="1" />
      {/* Nuki - shorter beam below */}
      <rect x="14" y="29" width="36" height="4" rx="1" />
      {/* Gakuzuka - middle column */}
      <rect x="30" y="24" width="4" height="6" />
      {/* Left pillar */}
      <rect x="14" y="33" width="6" height="27" rx="0.5" />
      {/* Right pillar */}
      <rect x="44" y="33" width="6" height="27" rx="0.5" />
    </svg>
  );
}

/**
 * Full lockup - torii + TAIYO TUITION text. Used on landing, login, footer.
 */
export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: { icon: "h-5 w-5", title: "text-sm", tag: "text-[9px]" },
    md: { icon: "h-7 w-7", title: "text-base", tag: "text-[10px]" },
    lg: { icon: "h-10 w-10", title: "text-xl", tag: "text-[11px]" },
  }[size];

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <ToriiMark className={dims.icon} color="var(--navy-800)" />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-semibold tracking-[0.14em] text-ink uppercase",
            dims.title,
          )}
        >
          Taiyo Tuition
        </span>
        <span
          className={cn(
            "tracking-[0.32em] text-muted uppercase mt-1",
            dims.tag,
          )}
        >
          Portal
        </span>
      </div>
    </div>
  );
}

/**
 * Boxed logo - torii inside the signature periwinkle card,
 * used for hero, login splash, and any standalone brand moment.
 */
export function LogoCard({
  className,
  size = 96,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={cn(
        "brand-field rounded-2xl flex flex-col items-center justify-center shadow-[0_8px_32px_-12px_rgba(74,103,180,0.35)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <ToriiMark
        className="h-10 w-10"
        color="var(--navy-800)"
      />
      <div className="mt-1.5 text-white font-bold tracking-[0.18em] text-[10px]">
        TAIYO
      </div>
      <div className="mt-0.5 text-white/90 tracking-[0.2em] text-[7px]">
        - TUITION -
      </div>
    </div>
  );
}
