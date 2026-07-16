import type { CSSProperties } from "react";

// Playful multi-colour angular shards. clip-path edges anti-alias cleanly, so
// they read crisp (not pixely) at any size.
const SHARDS: { style: CSSProperties; clip: string; color: string }[] = [
  { style: { left: "3%", top: "8%", width: 150, height: 150, transform: "rotate(16deg)", opacity: 0.18 }, clip: "polygon(0 0, 100% 26%, 30% 100%)", color: "#7b6ef0" },
  { style: { right: "6%", top: "10%", width: 104, height: 104, transform: "rotate(-12deg)", opacity: 0.16 }, clip: "polygon(0 20%, 100% 0, 76% 100%)", color: "#34d399" },
  { style: { left: "16%", bottom: "10%", width: 122, height: 122, transform: "rotate(28deg)", opacity: 0.13 }, clip: "polygon(0 0, 100% 42%, 48% 100%)", color: "#2e8fd6" },
  { style: { right: "11%", bottom: "15%", width: 166, height: 166, transform: "rotate(-20deg)", opacity: 0.1 }, clip: "polygon(14% 0, 100% 32%, 62% 100%, 0 68%)", color: "#f2616b" },
  { style: { left: "42%", top: "20%", width: 94, height: 94, transform: "rotate(6deg)", opacity: 0.12 }, clip: "polygon(0 0, 100% 52%, 38% 100%)", color: "#f58a07" },
];

/**
 * Decorative full-cover backdrop for the Math Blitz page. An aurora mesh (soft
 * multi-colour radial blends, slowly drifting) fills the tinted upper-left half;
 * a white lower-right half is cut with an anti-aliased clip-path diagonal (not a
 * gradient hard-stop, which stair-steps) with a soft accent line along the same
 * edge. Scattered arcade-colour shards add playful geometry. Purely decorative
 * (aria-hidden) and behind the opaque content, so text contrast is untouched.
 * Fills its positioned parent (which is min-h-full), so it covers the screen.
 */
export function BlitzBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Aurora mesh — soft radial blends, slowly drifting (oversized so the
          drift never reveals an edge) */}
      <div
        className="absolute -inset-[12%] blitz-aurora"
        style={{
          backgroundColor: "#ece9fe",
          backgroundImage:
            "radial-gradient(38% 46% at 12% 6%, rgba(123,110,240,0.55), transparent 60%)," +
            "radial-gradient(34% 42% at 84% 4%, rgba(52,211,153,0.45), transparent 60%)," +
            "radial-gradient(44% 48% at 28% 40%, rgba(46,143,214,0.34), transparent 62%)," +
            "radial-gradient(38% 44% at 72% 26%, rgba(242,97,107,0.26), transparent 62%)",
        }}
      />

      {/* White lower-right half — anti-aliased clip-path diagonal */}
      <div
        className="absolute inset-0"
        style={{
          background: "var(--surface)",
          clipPath: "polygon(100% 13%, 100% 100%, 0 100%, 0 63%)",
        }}
      />

      {/* Soft accent line along the same diagonal (blurred, so it never pixels) */}
      <div
        className="absolute inset-0 blur-[1.5px]"
        style={{
          background: "#8b7cf0",
          opacity: 0.4,
          clipPath: "polygon(100% 13%, 100% 14.6%, 0 64.6%, 0 63%)",
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
