import Link from "next/link";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  CalendarDays,
  TrendingUp,
  MessagesSquare,
  MessageCircle,
  Bell,
  CreditCard,
  LogOut,
  Gamepad2,
  Library,
} from "lucide-react";
import { ToriiMark } from "@/components/brand/wordmark";
import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { getUnreadCount } from "@/lib/notifications";
import { getOverallBlitzRank } from "@/app/student/math-game/_queries";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ProfileAvatar } from "@/components/profile-avatar";
import { StudentNavLinks, StudentNavLinksMobile, type NavSection } from "./nav-links";
import { CollapsiblePortalShell } from "@/components/portal/collapsible-shell";

const IC = "h-[18px] w-[18px]";

const SECTIONS: NavSection[] = [
  {
    heading: "Learning",
    items: [
      { label: "Dashboard",   href: "/student",            icon: <LayoutDashboard className={IC} /> },
      { label: "My subjects", href: "/student/subjects",   icon: <BookOpen className={IC} /> },
      { label: "Homework",    href: "/student/homework",   icon: <ClipboardList className={IC} /> },
      { label: "Timetable",   href: "/student/timetable",  icon: <CalendarDays className={IC} /> },
      { label: "Progress",    href: "/student/progress",   icon: <TrendingUp className={IC} /> },
      { label: "Resources",   href: "/student/resources",  icon: <Library className={IC} /> },
      { label: "Discussions", href: "/student/discussions", icon: <MessagesSquare className={IC} /> },
    ],
  },
  {
    heading: "Inbox",
    items: [
      { label: "Messages",      href: "/student/messages",      icon: <MessageCircle className={IC} /> },
      { label: "Notifications", href: "/student/notifications", icon: <Bell className={IC} /> },
    ],
  },
];

function BrandMark() {
  return (
    <Link href="/student" className="flex items-center gap-2.5">
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

export async function StudentShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  let unread = 0;
  let notifUnread = 0;
  let blitzRank: number | null = null;
  let profileAvatarKey: string | null = null;
  if (user) {
    const [threadResult, notificationResult, rankResult, avatarResult] =
      await Promise.allSettled([
        getUnreadThreadCount(user.id),
        getUnreadCount(user.id),
        getOverallBlitzRank(user.id),
        db
          .select({ profileAvatarKey: profiles.profileAvatarKey })
          .from(profiles)
          .where(eq(profiles.id, user.id))
          .limit(1),
      ]);
    if (threadResult.status === "fulfilled") unread = threadResult.value;
    else console.error("[student-shell] message count failed:", threadResult.reason);
    if (notificationResult.status === "fulfilled") {
      notifUnread = notificationResult.value;
    } else {
      console.error(
        "[student-shell] notification count failed:",
        notificationResult.reason,
      );
    }
    if (rankResult.status === "fulfilled") blitzRank = rankResult.value?.rank ?? null;
    else console.error("[student-shell] Taiyo Blitz rank failed:", rankResult.reason);
    if (avatarResult.status === "fulfilled") {
      profileAvatarKey = avatarResult.value[0]?.profileAvatarKey ?? null;
    } else {
      console.error("[student-shell] profile icon failed:", avatarResult.reason);
    }
  }
  // Unrestricted students self-manage billing, so they get a Payments link.
  const isUnrestricted =
    (user?.app_metadata?.role as string | undefined) === "student_unrestricted";
  const baseSections: NavSection[] = isUnrestricted
    ? SECTIONS.map((s) =>
        s.heading === "Inbox"
          ? {
              ...s,
              items: [
                ...s.items,
                {
                  label: "Payments",
                  href: "/student/payments",
                  icon: <CreditCard className={IC} />,
                },
              ],
            }
          : s,
      )
    : SECTIONS;
  const sections: NavSection[] = baseSections.map((s) => ({
    ...s,
    items: s.items.map((item) => {
      if (item.href === "/student/messages") return { ...item, badge: unread };
      if (item.href === "/student/notifications") {
        return { ...item, badge: notifUnread, badgeTone: "danger" as const };
      }
      return item;
    }),
  }));
  const initial = userName.charAt(0).toUpperCase();

  return (
    <CollapsiblePortalShell
      themeClassName="theme-student"
      desktopBrand={<BrandMark />}
      desktopActions={
        <>
          <Link
            href="/student/notifications"
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
            href="/student/messages"
            className="relative h-[34px] w-[34px] grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            aria-label="Messages"
          >
            <MessageCircle className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute top-[7px] right-[7px] w-[7px] h-[7px] rounded-full bg-brand-500 border-2 border-surface" />
            )}
          </Link>
          <Link
            href="/student/profile"
            className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 transition-colors hover:border-brand-300 hover:bg-surface-2"
            aria-label="Open profile and account settings"
          >
            <ProfileAvatar
              avatarKey={profileAvatarKey}
              fallback={initial}
              className="h-7 w-7 text-[12px]"
            />
            <div className="leading-tight">
              <div className="text-[13px] font-bold text-ink whitespace-nowrap">
                {userName}
              </div>
              <div className="text-[11px] text-muted capitalize">Student</div>
            </div>
          </Link>
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
          <Link
            href="/student/math-game"
            aria-label="Open Taiyo Blitz"
            title="Taiyo Blitz"
            className="portal-sidebar-feature group mb-3 block rounded-[18px] p-3.5 text-white shadow-sm transition-transform hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B6EF0]/60"
            style={{
              backgroundImage:
                "linear-gradient(120deg, #7B6EF0 0%, #6D3BD6 55%, #5A21B0 100%)",
            }}
          >
            <div className="portal-sidebar-feature-row flex items-center gap-2.5">
              <div className="relative h-9 w-9 shrink-0 grid place-items-center rounded-[12px] bg-white/20">
                <Gamepad2 className="h-5 w-5" />
                {blitzRank ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-extrabold tabular-nums text-[#5A21B0] shadow-sm">
                    #{blitzRank}
                  </span>
                ) : null}
              </div>
              <div className="portal-sidebar-feature-copy leading-tight">
                <div className="text-[13px] font-extrabold">Taiyo Blitz</div>
                <div className="text-[11px] text-white/80">Play &amp; climb the board</div>
              </div>
            </div>
          </Link>
          <div className="flex-1">
            <StudentNavLinks sections={sections} />
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
            <div className="flex items-center gap-1.5">
              <Link
                href="/student/profile"
                aria-label="Open profile and account settings"
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                <ProfileAvatar
                  avatarKey={profileAvatarKey}
                  fallback={initial}
                  className="h-9 w-9 text-[12px]"
                />
              </Link>
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
          </div>
          <StudentNavLinksMobile sections={sections} blitzRank={blitzRank} />
        </header>
      }
    >
      {children}
    </CollapsiblePortalShell>
  );
}
