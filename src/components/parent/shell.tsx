import Link from "next/link";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  MessageSquareText,
  TrendingUp,
  CreditCard,
  MessageCircle,
  Bell,
  LogOut,
  Search,
} from "lucide-react";
import { ToriiMark } from "@/components/brand/wordmark";
import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { ParentNavLinks, ParentNavLinksMobile, type NavSection } from "./nav-links";

const IC = "h-[18px] w-[18px]";

const SECTIONS: NavSection[] = [
  {
    heading: "Family",
    items: [
      { label: "Overview",   href: "/parent",            icon: <LayoutDashboard className={IC} /> },
      { label: "Classes",    href: "/parent/classes",    icon: <CalendarDays className={IC} /> },
      { label: "Attendance", href: "/parent/attendance", icon: <ClipboardCheck className={IC} /> },
      { label: "Homework",   href: "/parent/homework",   icon: <ClipboardList className={IC} /> },
      { label: "Feedback",   href: "/parent/feedback",   icon: <MessageSquareText className={IC} /> },
      { label: "Progress",   href: "/parent/progress",   icon: <TrendingUp className={IC} /> },
    ],
  },
  {
    heading: "Money",
    items: [
      { label: "Payments", href: "/parent/payments", icon: <CreditCard className={IC} /> },
    ],
  },
  {
    heading: "Inbox",
    items: [
      { label: "Messages",      href: "/parent/messages",      icon: <MessageCircle className={IC} /> },
      { label: "Notifications", href: "/parent/notifications", icon: <Bell className={IC} /> },
    ],
  },
];

function BrandMark() {
  return (
    <Link href="/parent" className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-brand-100 grid place-items-center text-brand-ink">
        <ToriiMark className="h-5 w-5" color="currentColor" />
      </div>
      <div className="leading-tight">
        <div className="text-[13px] font-extrabold tracking-[0.04em] uppercase text-ink">
          Taiyo
        </div>
        <div className="text-[10px] font-extrabold tracking-[0.18em] uppercase text-muted-2 -mt-0.5">
          Tuition
        </div>
      </div>
    </Link>
  );
}

/**
 * ParentShell — the parent portal's own chrome, mirroring TutorShell /
 * AdminShell so all v2 portals share the same top-bar + grouped-sidebar
 * layout. Scoped under `.theme-parent` (defined in src/app/parent/theme.css
 * with the same cornflower v2 tokens as .theme-tutor) so no shared CSS or
 * component changes are needed — the shared portal shell is left untouched.
 */
export async function ParentShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  let unread = 0;
  if (user) {
    try {
      unread = await getUnreadThreadCount(user.id);
    } catch (err) {
      console.error("[parent-shell] getUnreadThreadCount failed:", err);
      unread = 0;
    }
  }
  const sections: NavSection[] = SECTIONS.map((s) => ({
    ...s,
    items: s.items.map((item) =>
      item.href === "/parent/messages" ? { ...item, badge: unread } : item,
    ),
  }));
  const initial = userName.charAt(0).toUpperCase();

  return (
    <div className="theme-parent min-h-screen grid lg:grid-rows-[56px_1fr] lg:grid-cols-[240px_1fr]">
      {/* Top bar */}
      <header className="hidden lg:flex lg:col-span-2 items-center gap-4 bg-surface border-b border-line px-4 sticky top-0 z-30">
        <div className="w-[222px] pr-2 flex items-center">
          <BrandMark />
        </div>

        <div className="flex-1 max-w-[520px] flex items-center gap-2 bg-surface-2 border border-line rounded-full px-3.5 py-[7px] text-muted">
          <Search className="h-4 w-4 shrink-0" />
          <input
            type="search"
            placeholder="Search homework, feedback, invoices…"
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-ink placeholder:text-muted-2"
          />
          <span className="text-[11px] font-mono text-muted-2 shrink-0">⌘K</span>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href="/parent/notifications"
            className="relative h-[34px] w-[34px] grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
          </Link>
          <Link
            href="/parent/messages"
            className="relative h-[34px] w-[34px] grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            aria-label="Messages"
          >
            <MessageCircle className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute top-[7px] right-[7px] w-[7px] h-[7px] rounded-full bg-brand-500 border-2 border-surface" />
            )}
          </Link>
          <div className="flex items-center gap-2.5 pr-2.5 pl-1 py-1 rounded-full border border-line bg-surface">
            <div className="h-7 w-7 rounded-full bg-brand-500 text-white grid place-items-center text-[12px] font-bold">
              {initial}
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-bold text-ink whitespace-nowrap">
                {userName}
              </div>
              <div className="text-[11px] text-muted capitalize">Parent</div>
            </div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="h-[34px] w-[34px] grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col bg-surface border-r border-line overflow-y-auto p-3 pb-2">
        <div className="flex-1">
          <ParentNavLinks sections={sections} />
        </div>
        <div className="mt-4 pt-3 border-t border-line px-3 text-[11px] text-muted">
          <div>Taiyo Tuition · v0.4 preview</div>
          <div>© 2026 Taiyo Pty Ltd</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden bg-surface/95 backdrop-blur-md border-b border-line sticky top-0 z-40">
        <div className="px-5 h-14 flex items-center justify-between gap-3">
          <BrandMark />
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="h-9 w-9 grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
        <ParentNavLinksMobile sections={sections} />
      </header>

      {/* Main */}
      <main className="min-w-0 overflow-y-auto px-5 lg:px-7 py-6 lg:pb-16">
        {children}
      </main>
    </div>
  );
}
