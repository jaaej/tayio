import Link from "next/link";
import type { ReactNode } from "react";
import {
  Sunrise,
  BookOpen,
  Users,
  SquarePen,
  CalendarDays,
  CalendarCheck2,
  Handshake,
  Library,
  MessagesSquare,
  MessageCircle,
  Bell,
  LogOut,
} from "lucide-react";
import { ToriiMark } from "@/components/brand/wordmark";
import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { getUnreadCount } from "@/lib/notifications";
import { TutorNavLinks, TutorNavLinksMobile, type NavSection } from "./nav-links";
import { CollapsiblePortalShell } from "@/components/portal/collapsible-shell";

const IC = "h-[18px] w-[18px]";

const SECTIONS: NavSection[] = [
  {
    heading: "Teaching",
    items: [
      { label: "Today",      href: "/tutor",            icon: <Sunrise className={IC} /> },
      { label: "Classes",    href: "/tutor/classes",    icon: <BookOpen className={IC} /> },
      { label: "Students",   href: "/tutor/students",   icon: <Users className={IC} /> },
      { label: "Marking",    href: "/tutor/homework",   icon: <SquarePen className={IC} /> },
      { label: "Resources",  href: "/tutor/resources",  icon: <Library className={IC} /> },
    ],
  },
  {
    heading: "Schedule",
    items: [
      { label: "Schedule & availability", href: "/tutor/timetable", icon: <CalendarDays className={IC} /> },
      { label: "Cover board", href: "/tutor/cover", icon: <Handshake className={IC} /> },
      { label: "Weekly check-in", href: "/tutor/checkin", icon: <CalendarCheck2 className={IC} /> },
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
      <div className="h-8 w-8 rounded-lg bg-brand-100 grid place-items-center">
        <ToriiMark width={24} />
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
  let notifUnread = 0;
  if (user) {
    try {
      [unread, notifUnread] = await Promise.all([
        getUnreadThreadCount(user.id),
        getUnreadCount(user.id),
      ]);
    } catch (err) {
      console.error("[tutor-shell] badge counts failed:", err);
      unread = 0;
      notifUnread = 0;
    }
  }
  const sections: NavSection[] = SECTIONS.map((s) => ({
    ...s,
    items: s.items.map((item) => {
      if (item.href === "/tutor/messages") return { ...item, badge: unread };
      if (item.href === "/tutor/notifications") {
        return { ...item, badge: notifUnread, badgeTone: "danger" as const };
      }
      return item;
    }),
  }));
  const initial = userName.charAt(0).toUpperCase();

  return (
    <CollapsiblePortalShell
      themeClassName="theme-tutor"
      desktopBrand={<BrandMark />}
      desktopActions={
        <>
          <Link
            href="/tutor/notifications"
            className={`relative grid h-[34px] w-[34px] place-items-center rounded-lg transition-colors hover:bg-surface-2 ${notifUnread > 0 ? "text-bad" : "text-muted hover:text-ink"}`}
            aria-label={
              notifUnread > 0
                ? `${notifUnread} unread notification${notifUnread === 1 ? "" : "s"}`
                : "Notifications"
            }
          >
            <Bell className="h-[18px] w-[18px]" />
            {notifUnread > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-surface bg-bad px-1 text-[9px] font-extrabold leading-none tabular-nums text-white">
                {notifUnread > 99 ? "99+" : notifUnread}
              </span>
            )}
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
        </>
      }
      desktopSidebar={
        <>
          <div className="flex-1">
            <TutorNavLinks sections={sections} />
          </div>
          <div className="portal-sidebar-footer mt-4 pt-3 border-t border-line px-3 text-[11px] text-muted">
            <div>Taiyo Tuition · v0.4 preview</div>
            <div>© 2026 Taiyo Pty Ltd</div>
          </div>
        </>
      }
      mobileHeader={
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
      }
    >
      {children}
    </CollapsiblePortalShell>
  );
}
