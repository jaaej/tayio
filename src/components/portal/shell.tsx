import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/db/schema";
import { signOutAction } from "@/app/auth/actions";

type NavItem = { label: string; href: string };

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  student: [
    { label: "Dashboard", href: "/student" },
    { label: "My subjects", href: "/student/subjects" },
    { label: "Timetable", href: "/student/timetable" },
    { label: "Homework", href: "/student/homework" },
    { label: "Lessons", href: "/student/lessons" },
    { label: "Progress", href: "/student/progress" },
    { label: "Resources", href: "/student/resources" },
  ],
  parent: [
    { label: "Overview", href: "/parent" },
    { label: "Attendance", href: "/parent/attendance" },
    { label: "Homework", href: "/parent/homework" },
    { label: "Feedback", href: "/parent/feedback" },
    { label: "Payments", href: "/parent/payments" },
    { label: "Bookings", href: "/parent/bookings" },
  ],
  tutor: [
    { label: "Today", href: "/tutor" },
    { label: "Classes", href: "/tutor/classes" },
    { label: "Students", href: "/tutor/students" },
    { label: "Homework", href: "/tutor/homework" },
    { label: "Notes", href: "/tutor/notes" },
    { label: "Availability", href: "/tutor/availability" },
  ],
  admin: [
    { label: "Operations", href: "/admin" },
    { label: "Users", href: "/admin/users" },
    { label: "Classes", href: "/admin/classes" },
    { label: "Enrolments", href: "/admin/enrolments" },
    { label: "Payments", href: "/admin/payments" },
    { label: "Announcements", href: "/admin/announcements" },
    { label: "Reports", href: "/admin/reports" },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  student: "Student",
  parent: "Parent",
  tutor: "Tutor",
  admin: "Admin",
};

export function PortalShell({
  role,
  userName,
  children,
}: {
  role: UserRole;
  userName: string;
  children: ReactNode;
}) {
  const nav = NAV_BY_ROLE[role];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col bg-card border-r border-hairline/60 sticky top-0 h-screen px-5 py-6">
        <div className="px-2 mb-10">
          <Link href={`/${role}`}>
            <Wordmark />
          </Link>
        </div>

        <div className="px-2 text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
          {ROLE_LABEL[role]} portal
        </div>

        <nav className="flex-1 space-y-0.5">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2.5 text-sm rounded-lg text-ink-soft",
                "hover:bg-brand-50 hover:text-ink transition-colors",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User pod */}
        <div className="mt-6 pt-6 border-t border-hairline/60">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="h-9 w-9 rounded-full bg-navy-800 text-white flex items-center justify-center text-sm font-medium shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-ink truncate">{userName}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                {ROLE_LABEL[role]}
              </div>
            </div>
          </div>
          <form action={signOutAction} className="px-2">
            <button
              type="submit"
              className="w-full text-left text-xs text-ink-soft hover:text-ink transition-colors px-2 py-1.5 rounded-md hover:bg-brand-50"
            >
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
              className="px-3 py-1.5 text-xs whitespace-nowrap text-ink-soft hover:text-ink rounded-md hover:bg-brand-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Main */}
      <div className="min-w-0 flex flex-col">
        <main className="flex-1 px-6 lg:px-12 py-10 lg:py-14 w-full">
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
