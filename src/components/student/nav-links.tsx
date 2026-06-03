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

export type NavSection = {
  heading: string;
  items: NavItem[];
};

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(href + "/")) return true;
  return false;
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-[13px] font-semibold w-full text-left",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-ink-soft hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "shrink-0 transition-colors",
          active ? "text-brand-500" : "text-muted",
        )}
      >
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1.5 tabular-nums">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function StudentNavLinks({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {sections.map((section) => (
        <div key={section.heading}>
          <h6 className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-2 font-bold">
            {section.heading}
          </h6>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function StudentNavLinksMobile({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const items = sections.flatMap((s) => s.items);
  return (
    <nav className="px-6 pb-3 flex items-center gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap rounded-md transition-colors",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-ink-soft hover:bg-surface-2",
            )}
          >
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
