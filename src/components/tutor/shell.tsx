import Link from "next/link";
import type { ReactNode } from "react";
import {
  Sunrise,
  BookOpen,
  Users,
  FileText,
  SquarePen,
  CalendarDays,
  ClipboardCheck,
  MessagesSquare,
  MessageCircle,
  Bell,
  LogOut,
  Search,
} from "lucide-react";
import { ToriiMark } from "@/components/brand/wordmark";
import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { TutorNavLinks, TutorNavLinksMobile, type NavSection } from "./nav-links";

const IC = "h-[18px] w-[18px]";

const SECTIONS: NavSection[] = [
  {
    heading: "Teaching",
    items: [
      { label: "Today",      href: "/tutor",            icon: <Sunrise className={IC} /> },
      { label: "Classes",    href: "/tutor/classes",    icon: <BookOpen className={IC} /> },
      { label: "Students",   href: "/tutor/students",   icon: <Users className={IC} /> },
      { label: "Attendance", href: "/tutor/attendance", icon: <ClipboardCheck className={IC} /> },
      { label: "Marking",    href: "/tutor/homework",   icon: <SquarePen className={IC} /> },
      { label: "Notes",      href: "/tutor/notes",      icon: <FileText className={IC} /> },
    ],
  },
  {
    heading: "Schedule",
    items: [
      { label: "Timetable", href: "/tutor/timetable", icon: <CalendarDays className={IC} /> },
    ],
  },
  {
    heading: "Inbox",
    items: [
      { label: "Discussions",   href: "/tutor/discussions",   icon: <MessagesSquare className={IC} /> },
      { label: "Messages",      href: "/tutor/messages",      icon: <MessageCircle className={IC} /> },
      { label: "Notifications", href: "/tutor/notifications", icon: <Bell className={IC} /> },
    ],
  },
];

function BrandMark() {
  return (
    <Link href="/tutor" className="flex items-center gap-2.5">
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

export async function TutorShell({
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
      console.error("[tutor-shell] getUnreadThreadCount failed:", err);
      unread = 0;
    }
  }
  const sections: NavSection[] = SECTIONS.map((s) => ({
    ...s,
    items: s.items.map((item) =>
      item.href === "/tutor/messages" ? { ...item, badge: unread } : item,
    ),
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
            placeholder="Search classes, students, notes…"
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-ink placeholder:text-muted-2"
          />
          <span className="text-[11px] font-mono text-muted-2 shrink-0">⌘K</span>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href="/tutor/notifications"
            className="relative h-[34px] w-[34px] grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
          </Link>
          <Link
            href="/tutor/messages"
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
              <div className="text-[11px] text-muted capitalize">Tutor</div>
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
          <TutorNavLinks sections={sections} />
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
        <TutorNavLinksMobile sections={sections} />
      </header>

      {/* Main */}
      <main className="min-w-0 overflow-y-auto px-5 lg:px-7 py-6 lg:pb-16">
        {children}
      </main>
    </div>
  );
}
