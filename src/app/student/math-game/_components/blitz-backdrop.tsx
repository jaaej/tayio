/**
 * Full-screen aurora backdrop for the Math Blitz page: a soft, slowly-drifting
 * multi-colour gradient glow (violet · mint · sky) with no shapes or lines.
 *
 * Positioned `fixed` and pinned to the main content area (right of the sidebar,
 * below the header on desktop; full viewport on mobile) so it always covers the
 * whole screen regardless of content height, and stays put as the page scrolls.
 * Purely decorative (aria-hidden), behind the opaque cards, so text contrast is
 * untouched.
 */
export function BlitzBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden lg:left-60 lg:top-14"
    >
      {/* Oversized so the slow drift never reveals an edge */}
      <div
        className="absolute -inset-[15%] blitz-aurora"
        style={{
          backgroundColor: "#f4f2fe",
          backgroundImage:
            "radial-gradient(42% 52% at 14% 12%, rgba(123,110,240,0.42), transparent 60%)," +
            "radial-gradient(40% 50% at 86% 8%, rgba(52,211,153,0.34), transparent 60%)," +
            "radial-gradient(46% 54% at 22% 82%, rgba(46,143,214,0.32), transparent 62%)," +
            "radial-gradient(42% 50% at 80% 74%, rgba(139,124,240,0.30), transparent 62%)," +
            "radial-gradient(36% 44% at 54% 44%, rgba(242,97,107,0.14), transparent 66%)",
        }}
      />
    </div>
  );
}
