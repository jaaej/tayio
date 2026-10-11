"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "taiyo-portal-sidebar-collapsed";

/**
 * Glass portal chrome from the admin redesign: no top bar on desktop. The
 * floating glass sidebar carries the brand, search, menu and the signed-in
 * person; the page column holds each page's own glass header. Phones keep a
 * compact sticky header with the menu.
 *
 * Admin only while the redesign is reviewed; other roles still use
 * CollapsiblePortalShell.
 */
export function GlassPortalShell({
  brand,
  search,
  nav,
  account,
  mobileHeader,
  children,
}: {
  brand: ReactNode;
  search: ReactNode;
  nav: ReactNode;
  account: ReactNode;
  mobileHeader: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    } catch {
      // Storage can be unavailable in strict/private browser contexts.
    } finally {
      setPreferenceLoaded(true);
    }
  }, []);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Keep the in-memory preference when storage is unavailable.
      }
      return next;
    });
  }

  return (
    <div
      className="theme-tutor theme-admin min-h-screen text-ink"
      data-sidebar-collapsed={collapsed ? "true" : "false"}
    >
      {mobileHeader}
      <div className="flex items-start gap-5 lg:p-5">
        <aside
          id="portal-desktop-sidebar"
          className={cn(
            "portal-desktop-sidebar glass sticky top-5 hidden max-h-[calc(100vh-40px)] shrink-0 flex-col gap-1.5 overflow-hidden rounded-[24px] p-1.5 transition-[width] duration-200 ease-out lg:flex",
            collapsed ? "w-[76px]" : "w-[236px]",
            !preferenceLoaded && "[&_*]:duration-0 duration-0",
            collapsed &&
              "[&_.portal-nav-heading]:hidden [&_.portal-nav-label]:hidden [&_.portal-nav-item]:justify-center [&_.portal-nav-item]:gap-0 [&_.portal-nav-item]:px-0 [&_.portal-nav-badge]:absolute [&_.portal-nav-badge]:right-0.5 [&_.portal-nav-badge]:top-0.5 [&_.portal-nav-badge]:h-4 [&_.portal-nav-badge]:min-w-4 [&_.portal-nav-badge]:px-1 [&_.portal-nav-badge]:text-[9px] [&_.portal-sidebar-search]:justify-center [&_.portal-sidebar-search]:px-0 [&_.portal-brand-text]:hidden [&_.portal-account-text]:hidden [&_.portal-account]:flex-col [&_.portal-account]:px-0",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2 pb-2 pt-3",
              collapsed ? "flex-col px-1" : "pl-3 pr-1.5",
            )}
          >
            <div className="min-w-0 flex-1">{brand}</div>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand side menu" : "Collapse side menu"}
              aria-expanded={!collapsed}
              aria-controls="portal-desktop-sidebar"
              title={collapsed ? "Expand side menu" : "Collapse side menu"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-ink-soft transition-colors hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-[17px] w-[17px]" aria-hidden />
              ) : (
                <PanelLeftClose className="h-[17px] w-[17px]" aria-hidden />
              )}
            </button>
          </div>
          <div className="px-1 pb-0.5">{search}</div>
          <div
            className={cn(
              // Only the menu scrolls on short screens; brand, search and the
              // account row stay in view.
              "panel scroll-fade relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-3",
              collapsed ? "px-1.5" : "px-2",
            )}
          >
            {nav}
          </div>
          {account}
        </aside>

        {/* The window is the page scroller. overflow-x-clip stops wide
            content pushing the page sideways without creating a scroll
            container, so position: sticky inside pages still pins to the
            viewport. */}
        <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-x-clip px-4 py-4 sm:px-5 lg:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
