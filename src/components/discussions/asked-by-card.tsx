import Link from "next/link";
import type { UserRole } from "@/db/schema";
import { buttonVariants } from "@/components/admin/ui/button";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { cn } from "@/lib/utils";
import { RoleAvatar } from "./reply-list";

export type AskedByPerson = {
  name: string;
  role: UserRole;
  /** Context line under the name, e.g. "Year 11 · VCE Methods · your class". */
  meta: string;
  /** Only set where the viewer may open this person's profile. */
  profileHref?: string;
  /** Only set where the viewer may message this person. */
  messageHref?: string;
};

/**
 * Side-rail card on a discussion thread naming who asked it, with one-tap
 * links to their profile and a direct message. The tutor's thread view uses
 * it where admin sees moderation controls.
 */
export function AskedByCard({ person }: { person: AskedByPerson }) {
  const actions = [
    person.profileHref && { href: person.profileHref, label: "View student" },
    person.messageHref && { href: person.messageHref, label: "Message" },
  ].filter((a): a is { href: string; label: string } => Boolean(a));

  return (
    <GlassPanel
      as="aside"
      title="Asked by"
      titleId="asked-by-heading"
      bodyClassName="flex flex-col gap-3 p-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <RoleAvatar name={person.name} role={person.role} size={44} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-extrabold text-ink">
            {person.name}
          </span>
          <span className="text-[12px] text-muted">{person.meta}</span>
        </span>
      </div>
      {actions.length > 0 && (
        <div
          className={cn(
            "grid gap-2",
            actions.length > 1 ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={cn(
                buttonVariants({ variant: "outline", size: "md" }),
                "h-10 w-full",
              )}
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
