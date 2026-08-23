import Link from "next/link";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/db/schema";
import { tabsForRole, type UserTab } from "@/lib/user-detail-tabs";

/**
 * Tab bar for the user record. Links, not buttons: the active tab lives in
 * the URL so it survives the back button and can be shared. Renders nothing
 * for a role with one section, so the caller never branches on it.
 */
export function UserTabs({
  active,
  role,
  basePath,
}: {
  active: UserTab;
  role: UserRole;
  basePath: string;
}) {
  const tabs = tabsForRole(role);
  if (tabs.length < 2) return null;

  return (
    <nav
      aria-label="User sections"
      className="flex gap-1 overflow-x-auto border-b border-line"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`${basePath}?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-4 py-3 text-[14px] font-bold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              isActive
                ? "text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-600"
                : "text-ink-soft hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
