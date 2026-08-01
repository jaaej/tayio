import Link from "next/link";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  HelpCircle,
  ClipboardCheck,
  CreditCard,
  CalendarDays,
  CalendarClock,
  CalendarCheck,
  Megaphone,
  MessagesSquare,
  MessageCircle,
  Bell,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  Search,
  FolderOpen,
} from "lucide-react";
import { ToriiMark } from "@/components/brand/wordmark";
import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { getUnreadCount } from "@/lib/notifications";
import { AdminNavLinks, AdminNavLinksMobile, type NavSection } from "./nav-links";

const IC = "h-[18px] w-[18px]";

const SECTIONS: NavSection[] = [
  {
    heading: "Operations",
    items: [
      { label: "Operations", href: "/admin", icon: <LayoutDashboard className={IC} /> },
      { label: "Users", href: "/admin/users", icon: <Users className={IC} /> },
      { label: "Classes", href: "/admin/classes", icon: <BookOpen className={IC} /> },
      { label: "Quizzes", href: "/admin/quizzes", icon: <HelpCircle className={IC} /> },
      { label: "Attendance", href: "/admin/attendance", icon: <ClipboardCheck className={IC} /> },
      { label: "Reschedules", href: "/admin/reschedules", icon: <CalendarClock className={IC} /> },
      { label: "Tutor availability", href: "/admin/tutors/availability", icon: <CalendarCheck className={IC} /> },
    ],
  },
  {
    heading: "Schedule & money",
    items: [
      { label: "Terms", href: "/admin/terms", icon: <CalendarDays className={IC} /> },
      { label: "Payments", href: "/admin/payments", icon: <CreditCard className={IC} /> },
    ],
  },
  {
    heading: "Comms",
    items: [
      { label: "Announcements", href: "/admin/announcements", icon: <Megaphone className={IC} /> },
      { label: "Discussions", href: "/admin/discussions", icon: <MessagesSquare className={IC} /> },
      { label: "Resources", href: "/admin/resources", icon: <FolderOpen className={IC} /> },
      { label: "Messages", href: "/admin/messages", icon: <MessageCircle className={IC} /> },
      { label: "Notifications", href: "/admin/notifications", icon: <Bell className={IC} /> },
    ],
  },
  {
    heading: "Insight",
    items: [
      { label: "Reports", href: "/admin/reports", icon: <BarChart3 className={IC} /> },
      { label: "Revenue", href: "/admin/revenue", icon: <Wallet className={IC} /> },
      { label: "Settings", href: "/admin/settings", icon: <Settings className={IC} /> },
    ],
  },
];

function BrandMark() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5">
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
 * AdminShell - admin's own portal chrome, mirroring StudentShell / TutorShell.
 *
 * Wrapped in `.theme-tutor` so the admin subtree inherits the cornflower v2
 * token scope already defined in globals.css (brand-* / surface / ink / line).
 * There is no `.theme-admin` class and globals.css is out of scope to edit, so
 * admin reuses the existing staff-portal cornflower scope - same tokens, no new
 * ones, no globals.css change. This is the same mechanism student/tutor use.
 *
 * The shared `src/components/portal/shell.tsx` is intentionally NOT touched
 * (parent depends on it); this is a fresh admin-local shell.
 */
export async function AdminShell({
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
      console.error("[admin-shell] getUnreadThreadCount failed:", err);
      unread = 0;
    }
  }
  let notifUnread = 0;
  if (user) {
    try {
      notifUnread = await getUnreadCount(user.id);
    } catch (err) {
      console.error("[admin-shell] getUnreadCount failed:", err);
      notifUnread = 0;
    }
  }
  const sections: NavSection[] = SECTIONS.map((s) => ({
    ...s,
    items: s.items.map((item) => {
      if (item.href === "/admin/messages") return { ...item, badge: unread };
      if (item.href === "/admin/notifications") return { ...item, badge: notifUnread };
      return item;
    }),
  }));
  const initial = userName.charAt(0).toUpperCase();

  return (
    <div className="theme-tutor min-h-screen grid lg:grid-rows-[56px_1fr] lg:grid-cols-[240px_1fr]">
      {/* Top bar */}
      <header className="hidden lg:flex lg:col-span-2 items-center gap-4 bg-surface border-b border-line px-4 sticky top-0 z-30">
        <div className="w-[222px] pr-2 flex items-center">
          <BrandMark />
        </div>

        <div className="flex-1 max-w-[520px] flex items-center gap-2 bg-surface-2 border border-line rounded-full px-3.5 py-[7px] text-muted">
          <Search className="h-4 w-4 shrink-0" />
          <input
            type="search"
            placeholder="Search users, classes, payments…"
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-ink placeholder:text-muted-2"
          />
          <span className="text-[11px] font-mono text-muted-2 shrink-0">⌘K</span>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href="/admin/notifications"
            className="relative h-[34px] w-[34px] grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            {notifUnread > 0 && (
              <span className="absolute top-[7px] right-[7px] w-[7px] h-[7px] rounded-full bg-brand-500 border-2 border-surface" />
            )}
          </Link>
          <Link
            href="/admin/messages"
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
              <div className="text-[11px] text-muted capitalize">Admin</div>
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
          <AdminNavLinks sections={sections} />
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
        <AdminNavLinksMobile sections={sections} />
      </header>

      {/* Main */}
      <main className="min-w-0 overflow-y-auto px-5 lg:px-7 py-6 lg:pb-16">
        {children}
      </main>
    </div>
  );
}
