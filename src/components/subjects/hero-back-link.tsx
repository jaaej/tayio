import Link from "next/link";

/**
 * Back link for the coloured week hero, shared by the student and parent
 * curriculum pages so the same control looks and behaves the same in both.
 *
 * It carries its own ink scrim rather than being plain white-on-gradient. The
 * hero is subject-tinted and its top-left corner is the lightest part of the
 * gradient: on the lightest family (amber) white text there lands around
 * 2.5:1, which fails even the large-text threshold. Over the scrim white stays
 * above 5:1 for every subject family.
 *
 * `relative z-10` is on the link itself because the hero's decorative circles
 * are absolutely positioned siblings and would otherwise paint over it.
 */
export function HeroBackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="relative z-10 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/25 bg-ink/45 px-3 text-[11px] font-bold text-white transition-colors duration-150 hover:bg-ink/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
    >
      {children}
    </Link>
  );
}
