import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { UserRole } from "@/db/schema";
import { initialOf, roleColor } from "./dm-visuals";

/**
 * Shared conversation header: back link + role-coloured avatar + name/role.
 * Used across all portals' DM thread pages so the chat header is consistent.
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
    <div className="flex items-center gap-3 rounded-[16px] border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(15,17,30,0.04)]">
      <Link
        href={backHref}
        aria-label="Back to messages"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
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
          {otherRole}
        </div>
      </div>
    </div>
  );
}
