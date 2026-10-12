import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { UserRole } from "@/db/schema";
import { buttonVariants } from "@/components/admin/ui/button";
import { roleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { initialsOf, roleAvatarClass } from "./dm-visuals";

/**
 * Conversation title row, sitting on the glass frame above the white message
 * panel. The back button only shows on phones, where the inbox list and the
 * conversation are separate screens.
 */
export function ConversationHeader({
  otherName,
  otherRole,
  backHref,
  profileHref,
  profileLabel = "View profile",
  context,
  titleId,
}: {
  otherName: string;
  otherRole: UserRole;
  backHref: string;
  /** Link to the other person's profile, where the viewer's role has one. */
  profileHref?: string;
  profileLabel?: string;
  /** Who this person is to the viewer; defaults to their role. */
  context?: string;
  titleId: string;
}) {
  return (
    <div className="flex min-h-12 items-center gap-2.5 pb-2.5 pl-2 pr-2 pt-2 sm:pl-3">
      <Link
        href={backHref}
        aria-label="Back to messages"
        title="Back to messages"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/95 bg-white/65 text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 lg:hidden"
      >
        <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
      </Link>
      <span
        aria-hidden
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-extrabold",
          roleAvatarClass(otherRole),
        )}
      >
        {initialsOf(otherName)}
      </span>
      <div className="flex min-w-0 flex-col">
        <h2
          id={titleId}
          className="truncate text-[16px] font-extrabold leading-tight text-ink"
        >
          {otherName}
        </h2>
        <span className="truncate text-[12px] font-semibold text-ink-soft">
          {context ?? roleLabel(otherRole)}
        </span>
      </div>
      {profileHref && (
        <Link
          href={profileHref}
          className={cn(
            buttonVariants({ variant: "glass", size: "md" }),
            "ml-auto shrink-0",
          )}
        >
          {profileLabel}
        </Link>
      )}
    </div>
  );
}
