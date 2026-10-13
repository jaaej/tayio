import Link from "next/link";
import { buttonVariants } from "@/components/admin/ui/button";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { cn } from "@/lib/utils";

export type StuckLink = { href: string; label: string };

/**
 * Student side rail on a discussion thread: the next places to go when the
 * thread does not settle it - the subject's week page and a private message
 * to the tutor (or the office, on the General help board).
 */
export function StuckPanel({ links }: { links: StuckLink[] }) {
  return (
    <GlassPanel
      as="aside"
      title="Stuck on the same thing?"
      titleId="stuck-heading"
      bodyClassName="flex flex-col gap-2.5 p-4"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(buttonVariants({ variant: "outline", size: "md" }), "h-[38px] w-full")}
        >
          <span className="truncate">{link.label}</span>
        </Link>
      ))}
    </GlassPanel>
  );
}
