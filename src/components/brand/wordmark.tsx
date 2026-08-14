import { cn } from "@/lib/utils";

/**
 * Official Taiyo Tuition artwork, vendored under /public/brand.
 *
 * Served as <img> rather than inlined: the files are Illustrator exports that
 * carry their own <style> block with generic class names (.st0 ... .st11), so
 * inlining them would leak those rules into the document and collide between
 * instances. They are also multi-colour, so there is nothing to inherit from
 * currentColor. Width/height are always set so nothing reflows on load.
 */

/** Trimmed artboard of taiyo-mark.svg (1260.3 x 909.9 user units). */
const MARK_RATIO = 909.9 / 1260.3;

/**
 * Torii gate mark, on its own. Decorative in every current placement - the
 * brand name is always spelled out in real text beside it, so the mark is
 * hidden from screen readers to avoid announcing "Taiyo Tuition" twice.
 */
export function ToriiMark({ width = 24 }: { width?: number }) {
  return (
    <img
      src="/brand/taiyo-mark.svg"
      alt=""
      width={width}
      height={Math.round(width * MARK_RATIO)}
      draggable={false}
    />
  );
}

/**
 * Full lockup - torii + TAIYO TUITION text. Used on landing, login, footer.
 *
 * The text is typeset rather than the print wordmark asset: that asset is
 * white-filled for a dark office sign and reads as a hollow outline on any
 * light surface. See LogoCard for the one place the real lockup is used.
 */
export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: { icon: 26, title: "text-sm", tag: "text-[9px]" },
    md: { icon: 34, title: "text-base", tag: "text-[10px]" },
    lg: { icon: 48, title: "text-xl", tag: "text-[11px]" },
  }[size];

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <ToriiMark width={dims.icon} />
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
 * The real full lockup on the navy panel it was drawn for, used for hero,
 * login splash, and any standalone brand moment. The wordmark is white with a
 * fine dark outline, so it needs a dark ground - never place it on the
 * periwinkle brand field. Decorative: every page using it names the brand in
 * text elsewhere.
 */
export function LogoCard({
  className,
  width = 320,
}: {
  className?: string;
  width?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-[28px] px-[9%] py-[6%] shadow-[0_8px_32px_-12px_rgba(29,41,81,0.45)]",
        className,
      )}
      style={{
        width,
        background: "linear-gradient(155deg, #1d2951 0%, #00112f 100%)",
      }}
    >
      <img
        src="/brand/taiyo-logo-full.svg"
        alt=""
        width={3402}
        height={1701}
        className="w-full h-auto"
        draggable={false}
      />
    </div>
  );
}
