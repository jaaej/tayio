import Link from "next/link";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  CalendarClock,
  CalendarRange,
  CalendarCheck2,
  Megaphone,
  MessagesSquare,
  MessageCircle,
  Bell,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  FolderOpen,
  ListChecks,
  Layers,
  CalendarDays,
} from "lucide-react";
import { ToriiMark } from "@/components/brand/wordmark";
import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { isUnrestrictedAdmin } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { getUnreadCount } from "@/lib/notifications";
import { AdminNavLinks, AdminNavLinksMobile, type NavSection } from "./nav-links";
import { CoverAlertPoller } from "./cover-alert-poller";
import { GlassPortalShell } from "./glass-shell";
import { getRescheduleBadgeCount } from "@/app/admin/_lib/dashboard-queries";
import {
  AdminGlobalSearch,
  type AdminSearchDestination,
} from "@/components/admin/global-search";

// Owner-only destinations - reception (admin_restricted) is redirected away by
// requireUnrestrictedAdmin, so the nav must not surface a link that bounces.
// Revenue is NOT here: reception can open it and enter the PIN to view figures.
const OWNER_ONLY_HREFS = new Set(["/admin/settings", "/admin/tutor-checkins"]);

const IC = "h-[17px] w-[17px]";

const SECTIONS: NavSection[] = [
  {
    heading: "Operations",
    items: [
      { label: "Dashboard", href: "/admin", icon: <LayoutDashboard className={IC} /> },
      { label: "Users", href: "/admin/users", icon: <Users className={IC} /> },
      { label: "Classes", href: "/admin/classes", icon: <BookOpen className={IC} /> },
      { label: "Attendance", href: "/admin/attendance", icon: <ClipboardCheck className={IC} /> },
      { label: "Reschedules", href: "/admin/reschedules", icon: <CalendarClock className={IC} /> },
    ],
  },
  {
    heading: "Schedule",
    items: [
      {
        label: "Tutor availability",
        href: "/admin/tutors/availability",
        icon: <CalendarRange className={IC} />,
      },
      {
        label: "Tutor check-ins",
        href: "/admin/tutor-checkins",
        icon: <CalendarCheck2 className={IC} />,
      },
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
    heading: "Curriculum",
    items: [
      { label: "Curriculum", href: "/admin/subjects", icon: <Layers className={IC} /> },
      { label: "Quizzes", href: "/admin/quizzes", icon: <ListChecks className={IC} /> },
      { label: "Terms", href: "/admin/terms", icon: <CalendarDays className={IC} /> },
    ],
  },
  {
    heading: "Insight",
    items: [
      { label: "Reports", href: "/admin/reports", icon: <BarChart3 className={IC} /> },
      { label: "Payments", href: "/admin/payments", icon: <CreditCard className={IC} /> },
      { label: "Revenue", href: "/admin/revenue", icon: <Wallet className={IC} /> },
      { label: "Settings", href: "/admin/settings", icon: <Settings className={IC} /> },
    ],
  },
];

function BrandMark() {
  return (
    <Link
      href="/admin"
      aria-label="Taiyo Tuition dashboard"
      className="flex items-center gap-2.5 rounded-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      {/* The mark asset is navy; brightness-0 + invert turns it white on ink. */}
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px] bg-ink [&_img]:brightness-0 [&_img]:invert">
        <ToriiMark width={22} />
      </span>
      <span className="portal-brand-text flex flex-col leading-[1.1]">
        <span className="text-[15px] font-extrabold text-ink">Taiyo</span>
        <span className="text-[11px] uppercase tracking-[0.12em] text-ink-soft">
          Tuition
        </span>
      </span>
    </Link>
  );
}

/**
 * AdminShell - admin portal chrome in the glass redesign: the floating
 * sidebar holds brand, search, menu and the signed-in person (no top bar).
 * `.theme-admin` (globals.css) scopes the redesign's palette and font.
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
  let notifUnread = 0;
  let reschedulesWaiting = 0;
  if (user) {
    try {
      [unread, notifUnread, reschedulesWaiting] = await Promise.all([
        getUnreadThreadCount(user.id),
        getUnreadCount(user.id),
        getRescheduleBadgeCount(),
      ]);
    } catch (err) {
      console.error("[admin-shell] badge counts failed:", err);
      unread = 0;
      notifUnread = 0;
      reschedulesWaiting = 0;
    }
  }
  const canSeeOwnerNav = isUnrestrictedAdmin(
    user?.app_metadata?.role as UserRole | undefined,
  );
  const sections: NavSection[] = SECTIONS.map((s) => ({
    ...s,
    items: s.items
      .filter((item) => canSeeOwnerNav || !OWNER_ONLY_HREFS.has(item.href))
      .map((item) => {
        if (item.href === "/admin/messages") return { ...item, badge: unread };
        if (item.href === "/admin/reschedules") {
          return { ...item, badge: reschedulesWaiting };
        }
        if (item.href === "/admin/notifications") {
          return { ...item, badge: notifUnread, badgeTone: "danger" as const };
        }
        return item;
      }),
  })).filter((s) => s.items.length > 0);
  const searchDestinations: AdminSearchDestination[] = sections.flatMap(
    (section) =>
      section.items.map((item) => ({
        label: item.label,
        href: item.href,
        section: section.heading,
      })),
  );
  const initial = userName.charAt(0).toUpperCase();
  const roleLabel = canSeeOwnerNav ? "Owner" : "Reception";

  return (
    <>
      <CoverAlertPoller />
      <GlassPortalShell
        brand={<BrandMark />}
        search={
          <AdminGlobalSearch destinations={searchDestinations} variant="sidebar" />
        }
        nav={<AdminNavLinks sections={sections} />}
        account={
          <div className="portal-account flex items-center gap-2.5 pb-1.5 pl-2.5 pr-1.5 pt-2">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-extrabold text-white"
              aria-hidden
            >
              {initial}
            </span>
            <span className="portal-account-text flex min-w-0 flex-1 flex-col leading-[1.2]">
              <span className="truncate text-[13px] font-bold text-ink">{userName}</span>
              <span className="text-[12px] text-ink-soft">{roleLabel}</span>
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="grid h-9 w-9 place-items-center rounded-[10px] text-ink-soft transition-colors hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <LogOut className="h-[17px] w-[17px]" aria-hidden />
              </button>
            </form>
          </div>
        }
        mobileHeader={
          <header className="glass sticky top-0 z-40 rounded-b-[20px] border-t-0 lg:hidden">
            <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5">
              <BrandMark />
              <div className="flex items-center gap-1.5">
                <AdminGlobalSearch
                  destinations={searchDestinations}
                  compact
                  shortcutEnabled={false}
                />
                <form action={signOutAction}>
                  <button
                    type="submit"
                    aria-label="Sign out"
                    className="grid h-9 w-9 place-items-center rounded-[10px] text-ink-soft hover:bg-white/70 hover:text-ink"
                  >
                    <LogOut className="h-[18px] w-[18px]" />
                  </button>
                </form>
              </div>
            </div>
            <AdminNavLinksMobile sections={sections} />
          </header>
        }
      >
        {children}
      </GlassPortalShell>
    </>
  );
}
