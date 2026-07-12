import type { CSSProperties } from "react";

// Angular "shard" fragments scattered behind the content — same idea as the
// discussion ThreadBackdrop, but with a playful multi-colour arcade palette
// (one colour per shard) instead of a single subject accent.
const SHARDS: { style: CSSProperties; clip: string; color: string }[] = [
  { style: { left: "2%", top: "7%", width: 140, height: 140, transform: "rotate(16deg)", opacity: 0.16 }, clip: "polygon(0 0, 100% 26%, 30% 100%)", color: "#7b6ef0" },
  { style: { right: "5%", top: "11%", width: 100, height: 100, transform: "rotate(-12deg)", opacity: 0.15 }, clip: "polygon(0 20%, 100% 0, 76% 100%)", color: "#34d399" },
  { style: { left: "13%", bottom: "9%", width: 116, height: 116, transform: "rotate(28deg)", opacity: 0.13 }, clip: "polygon(0 0, 100% 42%, 48% 100%)", color: "#2e8fd6" },
  { style: { right: "9%", bottom: "13%", width: 158, height: 158, transform: "rotate(-20deg)", opacity: 0.11 }, clip: "polygon(14% 0, 100% 32%, 62% 100%, 0 68%)", color: "#f2616b" },
  { style: { left: "45%", top: "40%", width: 88, height: 88, transform: "rotate(6deg)", opacity: 0.1 }, clip: "polygon(0 0, 100% 52%, 38% 100%)", color: "#f58a07" },
];

/**
 * Decorative backdrop for the Math Blitz page: a light violet gradient wash
 * split by a diagonal divider (top-left tinted half + white lower half with a
 * crisp accent line), plus scattered multi-colour angular shards. Purely
 * decorative (aria-hidden), sits behind opaque content cards so it never
 * affects text contrast, and bleeds past the main padding to read full-page.
 */
export function BlitzBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-x-5 lg:-inset-x-7 -top-6 -bottom-16 overflow-hidden"
    >
      {/* Light arcade gradient wash */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(158deg, #efeafe 0%, #e7effe 100%)" }}
      />

      {/* Diagonal half divider — crisp accent line, white lower half, same angle */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "linear-gradient(122deg, transparent calc(50% - 0.75px), #b4a7f7 calc(50% - 0.75px), #b4a7f7 calc(50% + 0.75px), transparent calc(50% + 0.75px)), linear-gradient(122deg, transparent 0 50%, var(--surface) 50% 100%)",
        }}
      />

      {/* Shards */}
      {SHARDS.map((s, i) => (
        <div
          key={i}
          className="absolute"
          style={{ ...s.style, background: s.color, clipPath: s.clip }}
        />
      ))}
    </div>
  );
}
