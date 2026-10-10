"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MobilePortalNav } from "@/components/portal/mobile-nav";
import { isNavItemActive } from "@/lib/nav-active";

export type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
  badgeTone?: "brand" | "danger";
};

export type NavSection = {
  heading: string;
  items: NavItem[];
};

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      title={item.label}
      className={cn(
        "portal-nav-item group relative flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-[13px] font-semibold w-full text-left",
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
      <span className="portal-nav-label truncate">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span
          className={cn(
            "portal-nav-badge ml-auto inline-flex items-center justify-center rounded-full text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1.5 tabular-nums",
            item.badgeTone === "danger" ? "bg-bad" : "bg-brand-500",
          )}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AdminNavLinks({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {sections.map((section) => (
        <div key={section.heading}>
          <h6 className="portal-nav-heading px-3 mb-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-2 font-bold">
            {section.heading}
          </h6>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                active={isNavItemActive(pathname, item.href)}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminNavLinksMobile({ sections }: { sections: NavSection[] }) {
  const items = sections.flatMap((s) => s.items);
  return <MobilePortalNav items={items} />;
}
