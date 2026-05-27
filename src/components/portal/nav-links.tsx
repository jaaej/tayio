"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
};

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (pathname === href) return true;
    // /student is the dashboard — only exact match counts as active
    // /student/subjects matches /student/subjects/[anything]
    if (href !== "/" && pathname.startsWith(href + "/")) return true;
    return false;
  }

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-lg transition-all duration-150",
              active
                ? "bg-brand-100 text-ink font-semibold"
                : "text-ink-soft hover:bg-brand-50 hover:text-ink",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-brand-700"
              />
            )}
            <span
              className={cn(
                "shrink-0 transition-colors",
                active
                  ? "text-brand-700"
                  : "text-muted group-hover:text-brand-700",
              )}
            >
              {item.icon}
            </span>
            <span className="text-[17px] tracking-tight">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-semibold min-w-5 h-5 px-1.5 tabular-nums">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
