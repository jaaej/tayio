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
  FolderOpen,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isUnrestrictedAdmin } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { getUnreadCount } from "@/lib/notifications";
import {
  GlassNavLinks,
  GlassNavLinksMobile,
  type NavSection,
} from "@/components/portal/glass-nav-links";
import { CoverAlertPoller } from "./cover-alert-poller";
import { GlassPortalShell } from "@/components/portal/glass-shell";
import {
  GlassAccount,
  GlassBrandMark,
  GlassInitial,
  GlassMobileHeader,
} from "@/components/portal/glass-chrome";
import { getRescheduleBadgeCount } from "@/app/admin/_lib/dashboard-queries";
import {
  PortalSearch,
  type PortalSearchDestination,
} from "@/components/portal/global-search";

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
      {
        label: "Classes",
        href: "/admin/classes",
        icon: <BookOpen className={IC} />,
        // Curriculum, quizzes and terms are run from Classes.
        also: ["/admin/subjects", "/admin/quizzes", "/admin/terms"],
      },
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
    heading: "Insight",
    items: [
      { label: "Reports", href: "/admin/reports", icon: <BarChart3 className={IC} /> },
      { label: "Payments", href: "/admin/payments", icon: <CreditCard className={IC} /> },
      { label: "Revenue", href: "/admin/revenue", icon: <Wallet className={IC} /> },
      { label: "Settings", href: "/admin/settings", icon: <Settings className={IC} /> },
    ],
  },
];

/**
 * AdminShell - admin portal chrome in the glass redesign: the floating
 * sidebar holds brand, search, menu and the signed-in person (no top bar).
 * `.theme-glass` (globals.css) scopes the redesign's palette and font.
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
  const searchDestinations: PortalSearchDestination[] = [
    ...sections.flatMap((section) =>
      section.items.map((item) => ({
        label: item.label,
        href: item.href,
        section: section.heading,
      })),
    ),
    // Reached from Classes rather than the menu, but still searchable.
    { label: "Quizzes", href: "/admin/quizzes", section: "Classes" },
    { label: "Terms", href: "/admin/terms", section: "Classes" },
  ];
  const initial = userName.charAt(0).toUpperCase();
  const roleLabel = canSeeOwnerNav ? "Owner" : "Reception";

  const directory = {
    href: "/admin/users",
    label: "Search users, classes and subjects",
    placeholder: "Search users, classes, subjects, or pages…",
  };

  return (
    <>
      <CoverAlertPoller />
      <GlassPortalShell
        brand={<GlassBrandMark href="/admin" />}
        search={
          <PortalSearch
            destinations={searchDestinations}
            directory={directory}
            variant="sidebar"
          />
        }
        nav={<GlassNavLinks sections={sections} />}
        account={
          <GlassAccount
            name={userName}
            roleLabel={roleLabel}
            avatar={<GlassInitial initial={initial} />}
          />
        }
        mobileHeader={
          <GlassMobileHeader
            brandHref="/admin"
            search={
              <PortalSearch
                destinations={searchDestinations}
                directory={directory}
                compact
                shortcutEnabled={false}
              />
            }
            nav={<GlassNavLinksMobile sections={sections} />}
          />
        }
      >
        {children}
      </GlassPortalShell>
    </>
  );
}
