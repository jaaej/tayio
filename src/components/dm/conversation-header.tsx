import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { UserRole } from "@/db/schema";
import { roleLabel } from "@/lib/roles";
import { initialOf, roleColor } from "./dm-visuals";

/**
 * Shared conversation header: back link + role-coloured avatar + name/role.
 * Rendered at the top of the shared ConversationPanel for every role.
 */
export function ConversationHeader({
  otherName,
  otherRole,
  backHref,
}: {
  otherName: string;
  otherRole: UserRole;
  backHref: string;
}) {
  const color = roleColor(otherRole);
  return (
    <div className="flex items-center gap-3 border-b border-white/60 px-4 py-3.5 sm:px-6">
      <Link
        href={backHref}
        aria-label="Back to messages"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-white/60 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Link>
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-bold text-white shadow-[0_4px_12px_-5px_rgba(31,40,90,0.5)]"
        style={{ background: color }}
      >
        {initialOf(otherName)}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[16px] font-extrabold tracking-[-0.01em] text-ink">
          {otherName}
        </div>
        <div
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color }}
        >
          {roleLabel(otherRole)}
        </div>
      </div>
    </div>
  );
}
