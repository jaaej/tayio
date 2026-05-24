import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/db/schema";

type NavItem = { label: string; href: string };

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  student: [
    { label: "Overview", href: "/student" },
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
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-hairline/60 bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link href={`/${role}`} className="flex items-center">
              <Wordmark />
            </Link>
            <nav className="hidden lg:flex items-center gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 text-sm text-ink-soft hover:text-ink rounded-lg",
                    "hover:bg-brand-100 transition-colors",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
              {ROLE_LABEL[role]}
            </span>
            <div className="h-9 w-9 rounded-full bg-navy-800 text-white flex items-center justify-center text-sm font-medium">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 lg:px-10 py-10 lg:py-14">
        {children}
      </main>

      <footer className="border-t border-hairline/60 mt-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-6 flex items-center justify-between text-xs text-ink-soft">
          <span>© Taiyo Tuition</span>
          <span className="font-display italic">太陽</span>
        </div>
      </footer>
    </div>
  );
}
