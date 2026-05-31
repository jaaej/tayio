import Link from "next/link";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  TrendingUp,
  MessageSquareText,
  MessagesSquare,
  MessageCircle,
  CreditCard,
  Sunrise,
  Users,
  FileText,
  Clock,
  UserPlus,
  Megaphone,
  BarChart3,
  Bell,
  LogOut,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import type { UserRole } from "@/db/schema";
import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { NavLinks, type NavItem } from "./nav-links";

const ICON_CLASS = "h-[18px] w-[18px]";

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  student: [
    { label: "Dashboard", href: "/student", icon: <LayoutDashboard className={ICON_CLASS} /> },
    { label: "My subjects", href: "/student/subjects", icon: <BookOpen className={ICON_CLASS} /> },
    { label: "Timetable", href: "/student/timetable", icon: <CalendarDays className={ICON_CLASS} /> },
    { label: "Homework", href: "/student/homework", icon: <ClipboardList className={ICON_CLASS} /> },
    { label: "Discussions", href: "/student/discussions", icon: <MessagesSquare className={ICON_CLASS} /> },
    { label: "Messages", href: "/student/messages", icon: <MessageCircle className={ICON_CLASS} /> },
    { label: "Notifications", href: "/student/notifications", icon: <Bell className={ICON_CLASS} /> },
    { label: "Progress", href: "/student/progress", icon: <TrendingUp className={ICON_CLASS} /> },
    { label: "Resources", href: "/student/resources", icon: <GraduationCap className={ICON_CLASS} /> },
  ],
  parent: [
    { label: "Overview", href: "/parent", icon: <LayoutDashboard className={ICON_CLASS} /> },
    { label: "Classes", href: "/parent/classes", icon: <CalendarDays className={ICON_CLASS} /> },
    { label: "Homework", href: "/parent/homework", icon: <ClipboardList className={ICON_CLASS} /> },
    { label: "Feedback", href: "/parent/feedback", icon: <MessageSquareText className={ICON_CLASS} /> },
    { label: "Messages", href: "/parent/messages", icon: <MessageCircle className={ICON_CLASS} /> },
    { label: "Notifications", href: "/parent/notifications", icon: <Bell className={ICON_CLASS} /> },
    { label: "Progress", href: "/parent/progress", icon: <TrendingUp className={ICON_CLASS} /> },
    { label: "Payments", href: "/parent/payments", icon: <CreditCard className={ICON_CLASS} /> },
  ],
  tutor: [
    { label: "Today", href: "/tutor", icon: <Sunrise className={ICON_CLASS} /> },
    { label: "Classes", href: "/tutor/classes", icon: <BookOpen className={ICON_CLASS} /> },
    { label: "Students", href: "/tutor/students", icon: <Users className={ICON_CLASS} /> },
    { label: "Notes", href: "/tutor/notes", icon: <FileText className={ICON_CLASS} /> },
    { label: "Discussions", href: "/tutor/discussions", icon: <MessagesSquare className={ICON_CLASS} /> },
    { label: "Messages", href: "/tutor/messages", icon: <MessageCircle className={ICON_CLASS} /> },
    { label: "Notifications", href: "/tutor/notifications", icon: <Bell className={ICON_CLASS} /> },
    { label: "Schedule", href: "/tutor/schedule", icon: <CalendarDays className={ICON_CLASS} /> },
  ],
  admin: [
    { label: "Operations", href: "/admin", icon: <LayoutDashboard className={ICON_CLASS} /> },
    { label: "Users", href: "/admin/users", icon: <Users className={ICON_CLASS} /> },
    { label: "Classes", href: "/admin/classes", icon: <BookOpen className={ICON_CLASS} /> },
    { label: "Attendance", href: "/admin/attendance", icon: <ClipboardList className={ICON_CLASS} /> },
    { label: "Payments", href: "/admin/payments", icon: <CreditCard className={ICON_CLASS} /> },
    { label: "Announcements", href: "/admin/announcements", icon: <Megaphone className={ICON_CLASS} /> },
    { label: "Terms", href: "/admin/terms", icon: <CalendarDays className={ICON_CLASS} /> },
    { label: "Discussions", href: "/admin/discussions", icon: <MessagesSquare className={ICON_CLASS} /> },
    { label: "Messages", href: "/admin/messages", icon: <MessageCircle className={ICON_CLASS} /> },
    { label: "Notifications", href: "/admin/notifications", icon: <Bell className={ICON_CLASS} /> },
    { label: "Reports", href: "/admin/reports", icon: <BarChart3 className={ICON_CLASS} /> },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  student: "Student",
  parent: "Parent",
  tutor: "Tutor",
  admin: "Admin",
};

export async function PortalShell({
  role,
  userName,
  children,
}: {
  role: UserRole;
  userName: string;
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  // Badge is best-effort: if the DM tables aren't migrated yet or the query
  // fails for any reason, fall back to 0 rather than crash the entire shell
  // (which would break every page in the portal).
  let unread = 0;
  if (user) {
    try {
      unread = await getUnreadThreadCount(user.id);
    } catch (err) {
      console.error("[shell] getUnreadThreadCount failed:", err);
      unread = 0;
    }
  }
  const messagesHref = `/${role}/messages`;
  const nav = NAV_BY_ROLE[role].map((item) =>
    item.href === messagesHref ? { ...item, badge: unread } : item,
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col bg-card border-r border-hairline/60 sticky top-0 h-screen px-4 py-6">
        <div className="px-3 mb-8">
          <Link href={`/${role}`}>
            <Wordmark />
          </Link>
        </div>

        <div className="px-3 text-[10px] uppercase tracking-[0.2em] text-muted mb-3 font-medium">
          {ROLE_LABEL[role]} portal
        </div>

        <div className="flex-1 overflow-y-auto -mr-2 pr-2">
          <NavLinks items={nav} />
        </div>

        {/* User pod */}
        <div className="mt-6 pt-5 border-t border-hairline/60">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="h-9 w-9 rounded-full bg-navy-800 text-white flex items-center justify-center text-sm font-medium shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink truncate font-medium">{userName}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                {ROLE_LABEL[role]}
              </div>
            </div>
          </div>
          <form action={signOutAction} className="px-2">
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 text-left text-[13px] text-ink-soft hover:text-ink transition-colors px-2 py-2 rounded-md hover:bg-brand-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar (sidebar replacement) */}
      <header className="lg:hidden bg-card/90 backdrop-blur-md border-b border-hairline/60 sticky top-0 z-40">
        <div className="px-6 h-16 flex items-center justify-between">
          <Link href={`/${role}`}>
            <Wordmark />
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-[11px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
        <nav className="px-6 pb-3 flex items-center gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap text-ink-soft hover:text-ink rounded-md hover:bg-brand-50"
            >
              <span className="shrink-0">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Main */}
      <div className="min-w-0 flex flex-col">
        <main className="flex-1 px-6 lg:px-10 xl:px-14 py-10 lg:py-12 w-full">
          {children}
        </main>
        <footer className="border-t border-hairline/60 mt-12">
          <div className="px-6 lg:px-12 py-6 flex items-center justify-between text-xs text-ink-soft">
            <span>© Taiyo Tuition · Mount Waverley, VIC</span>
            <span className="text-muted">太陽</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
