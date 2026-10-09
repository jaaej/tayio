"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobilePortalNavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
  badgeTone?: "brand" | "danger";
  featured?: boolean;
};

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  const routeDepth = href.split("/").filter(Boolean).length;
  return routeDepth > 1 && pathname.startsWith(`${href}/`);
}

export function MobilePortalNav({
  items,
}: {
  items: MobilePortalNavItem[];
}) {
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const active = items.find((item) => isActive(pathname, item.href));

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="border-t border-line px-3 pb-2 pt-2 sm:px-5">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 text-left text-[12px] font-bold text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <Menu className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
        <span className="text-muted">Menu</span>
        <span className="min-w-0 flex-1 truncate text-right text-ink">
          {active?.label ?? "Choose a page"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <nav
          id={panelId}
          aria-label="Portal navigation"
          className="mt-2 grid max-h-[min(60dvh,520px)] grid-cols-2 gap-1.5 overflow-y-auto rounded-[14px] border border-line bg-surface p-2 shadow-[0_16px_34px_-22px_rgba(31,40,90,0.45)]"
        >
          {items.map((item) => {
            const itemActive = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex min-h-11 min-w-0 items-center gap-2 rounded-[10px] px-3 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  item.featured
                    ? "bg-[linear-gradient(120deg,#7B6EF0_0%,#6D3BD6_55%,#5A21B0_100%)] text-white"
                    : itemActive
                      ? "bg-brand-50 text-brand-700"
                      : "bg-surface-2 text-ink-soft hover:bg-brand-50",
                )}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span
                    className={cn(
                      "ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white tabular-nums",
                      item.badgeTone === "danger" ? "bg-bad" : "bg-brand-500",
                    )}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
