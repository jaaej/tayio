import type { CSSProperties } from "react";
import type { AccentTokens } from "@/lib/subject-colors";

// Angular "shard" fragments scattered behind the thread content. Each is a
// clip-path polygon in the subject accent colour at low opacity. Positions are
// inline styles (not Tailwind classes) so they render independent of the JIT
// scanner.
const SHARDS: { style: CSSProperties; clip: string }[] = [
  { style: { left: "2%", top: "7%", width: 130, height: 130, transform: "rotate(16deg)", opacity: 0.16 }, clip: "polygon(0 0, 100% 26%, 30% 100%)" },
  { style: { right: "5%", top: "12%", width: 92, height: 92, transform: "rotate(-12deg)", opacity: 0.12 }, clip: "polygon(0 20%, 100% 0, 76% 100%)" },
  { style: { left: "12%", bottom: "8%", width: 108, height: 108, transform: "rotate(28deg)", opacity: 0.1 }, clip: "polygon(0 0, 100% 42%, 48% 100%)" },
  { style: { right: "10%", bottom: "14%", width: 150, height: 150, transform: "rotate(-20deg)", opacity: 0.09 }, clip: "polygon(14% 0, 100% 32%, 62% 100%, 0 68%)" },
  { style: { left: "46%", top: "44%", width: 76, height: 76, transform: "rotate(6deg)", opacity: 0.08 }, clip: "polygon(0 0, 100% 52%, 38% 100%)" },
];

/**
 * Decorative backdrop for the discussion thread page: a light subject-colour
 * gradient wash split by a diagonal divider, with angular "shard" fragments.
 * Purely decorative (aria-hidden) and sits behind the opaque content cards, so
 * it never affects text contrast. Bleeds past the main padding via negative
 * insets to read as a full-page background.
 */
export function ThreadBackdrop({ tokens }: { tokens: AccentTokens }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-x-5 lg:-inset-x-7 -top-6 -bottom-16 overflow-hidden"
    >
      {/* Light subject-colour gradient wash */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(158deg, ${tokens.bgFrom} 0%, ${tokens.bgTo} 100%)`,
        }}
      />

      {/* Diagonal half divider — lighter half + a crisp accent line, same angle */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background: `linear-gradient(122deg, transparent calc(50% - 0.75px), ${tokens.ring} calc(50% - 0.75px), ${tokens.ring} calc(50% + 0.75px), transparent calc(50% + 0.75px)), linear-gradient(122deg, transparent 0 50%, var(--surface) 50% 100%)`,
        }}
      />

      {/* Shards */}
      {SHARDS.map((s, i) => (
        <div
          key={i}
          className="absolute"
          style={{ ...s.style, background: tokens.arrow, clipPath: s.clip }}
        />
      ))}
    </div>
  );
}
