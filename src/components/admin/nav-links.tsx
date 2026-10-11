"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
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
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "portal-nav-item group relative flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        active
          ? "bg-ink font-bold text-white"
          : "font-medium text-ink-soft hover:bg-[#F1F2F7]",
      )}
    >
      <span className="shrink-0">{item.icon}</span>
      <span className="portal-nav-label flex-1 truncate">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span
          className={cn(
            "portal-nav-badge inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold tabular-nums",
            item.badgeTone === "danger"
              ? "bg-[#D92D20] text-white"
              : active
                ? "bg-white text-ink"
                : "bg-surface-3 text-ink",
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
  const navRef = useRef<HTMLElement>(null);

  // The menu scrolls on short screens; keep the current page's item in view
  // so the highlight is never hidden below the fold.
  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <nav ref={navRef} aria-label="Main" className="flex flex-col gap-3.5">
      {sections.map((section) => (
        <div key={section.heading} className="flex flex-col gap-px">
          <h2 className="portal-nav-heading px-2.5 pb-[5px] text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">
            {section.heading}
          </h2>
          {section.items.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              active={isNavItemActive(pathname, item.href)}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

export function AdminNavLinksMobile({ sections }: { sections: NavSection[] }) {
  const items = sections.flatMap((s) => s.items);
  return <MobilePortalNav items={items} />;
}
