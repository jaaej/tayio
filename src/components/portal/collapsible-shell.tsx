"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "taiyo-portal-sidebar-collapsed";

export function CollapsiblePortalShell({
  themeClassName,
  desktopBrand,
  desktopActions,
  desktopSidebar,
  mobileHeader,
  children,
}: {
  themeClassName: string;
  desktopBrand: ReactNode;
  desktopActions: ReactNode;
  desktopSidebar: ReactNode;
  mobileHeader: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    } catch {
      // Storage can be unavailable in strict/private browser contexts. The
      // sidebar still works for the current session in that case.
    } finally {
      setPreferenceLoaded(true);
    }
  }, []);

  function toggleSidebar() {
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
      className={cn(
        themeClassName,
        "min-h-screen grid lg:grid-rows-[56px_1fr] transition-[grid-template-columns] duration-200 ease-out",
        collapsed
          ? "lg:grid-cols-[72px_minmax(0,1fr)]"
          : "lg:grid-cols-[240px_minmax(0,1fr)]",
      )}
      data-sidebar-collapsed={collapsed ? "true" : "false"}
    >
      <header className="hidden lg:flex lg:col-span-2 items-center gap-4 bg-surface border-b border-line px-4 sticky top-0 z-30">
        <div
          className={cn(
            "flex shrink-0 items-center transition-[width] duration-200 ease-out",
            collapsed ? "w-10 justify-center" : "w-[224px] justify-between",
          )}
        >
          <div
            className={cn(
              "min-w-0 overflow-hidden transition-opacity duration-150",
              collapsed ? "w-0 opacity-0" : "opacity-100",
            )}
            aria-hidden={collapsed || undefined}
          >
            {desktopBrand}
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand side menu" : "Collapse side menu"}
            aria-expanded={!collapsed}
            aria-controls="portal-desktop-sidebar"
            title={collapsed ? "Expand side menu" : "Collapse side menu"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-muted shadow-sm transition-colors hover:border-brand-300 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2.5">{desktopActions}</div>
      </header>

      <aside
        id="portal-desktop-sidebar"
        className={cn(
          "portal-desktop-sidebar hidden lg:flex flex-col bg-surface border-r border-line overflow-x-hidden overflow-y-auto pb-2 transition-[padding] duration-200 ease-out",
          collapsed ? "px-2 pt-3" : "p-3",
          !preferenceLoaded && "[&_*]:duration-0",
          collapsed &&
            "[&_.portal-nav-heading]:hidden [&_.portal-nav-label]:hidden [&_.portal-nav-item]:justify-center [&_.portal-nav-item]:gap-0 [&_.portal-nav-item]:px-2 [&_.portal-nav-badge]:absolute [&_.portal-nav-badge]:right-0 [&_.portal-nav-badge]:top-0 [&_.portal-nav-badge]:ml-0 [&_.portal-nav-badge]:h-4 [&_.portal-nav-badge]:min-w-4 [&_.portal-nav-badge]:px-1 [&_.portal-nav-badge]:text-[8px] [&_.portal-sidebar-feature-copy]:hidden [&_.portal-sidebar-feature]:p-2.5 [&_.portal-sidebar-feature]:rounded-[14px] [&_.portal-sidebar-feature-row]:justify-center [&_.portal-sidebar-footer]:hidden",
        )}
      >
        {desktopSidebar}
      </aside>

      {mobileHeader}

      <main className="min-w-0 overflow-y-auto px-5 lg:px-7 py-6 lg:pb-16">
        {children}
      </main>
    </div>
  );
}
