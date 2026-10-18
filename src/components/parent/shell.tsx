import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Library,
  Bell,
  MessageCircle,
  MessageSquareText,
  TrendingUp,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { yearLevelLabel } from "@/lib/format";
import { getUnreadCount } from "@/lib/notifications";
import { SELECTED_CHILD_COOKIE } from "@/lib/parent-child";
import { getParentChildren } from "@/app/parent/_data";
import { GlassPortalShell } from "@/components/portal/glass-shell";
import {
  GlassNavLinks,
  GlassNavLinksMobile,
  type NavSection,
} from "@/components/portal/glass-nav-links";
import {
  GlassAccount,
  GlassBrandMark,
  GlassInitial,
  GlassMobileHeader,
} from "@/components/portal/glass-chrome";
import { PortalSearch, type PortalSearchDestination } from "@/components/portal/global-search";
import { ChildPicker, type PickerChild } from "./child-picker";

const IC = "h-[17px] w-[17px]";

const SECTIONS: NavSection[] = [
  {
    heading: "Family",
    items: [
      { label: "Overview", href: "/parent", icon: <LayoutDashboard className={IC} /> },
      { label: "Subjects", href: "/parent/subjects", icon: <BookOpen className={IC} /> },
      { label: "Timetable", href: "/parent/timetable", icon: <CalendarDays className={IC} /> },
      { label: "Homework", href: "/parent/homework", icon: <ClipboardList className={IC} /> },
      { label: "Feedback", href: "/parent/feedback", icon: <MessageSquareText className={IC} /> },
      { label: "Progress", href: "/parent/progress", icon: <TrendingUp className={IC} /> },
      { label: "Resources", href: "/parent/resources", icon: <Library className={IC} /> },
    ],
  },
  {
    heading: "Inbox",
    items: [
      { label: "Messages", href: "/parent/messages", icon: <MessageCircle className={IC} /> },
      { label: "Notifications", href: "/parent/notifications", icon: <Bell className={IC} /> },
      { label: "Payments", href: "/parent/payments", icon: <CreditCard className={IC} /> },
    ],
  },
];

/** A failed badge query must never take the whole portal down. */
function settled<T>(result: PromiseSettledResult<T>, label: string, fallback: T): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[parent-shell] ${label} failed:`, result.reason);
  return fallback;
}

/**
 * ParentShell - the parent portal on the shared glass shell (the same
 * component as the student, tutor and admin portals), with the parent's
 * menu and, for a family with more than one child, the child switcher
 * between search and the menu (initials in the phone header).
 */
export async function ParentShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  let messages = 0;
  let notifications = 0;
  let kids: PickerChild[] = [];
  if (user) {
    const [messageResult, notificationResult, kidsResult] = await Promise.allSettled([
      getUnreadThreadCount(user.id),
      getUnreadCount(user.id),
      getParentChildren(user.id),
    ]);
    messages = settled(messageResult, "message count", 0);
    notifications = settled(notificationResult, "notification count", 0);
    kids = settled(kidsResult, "children", []).map((k) => ({
      id: k.id,
      firstName: k.firstName,
      yearLevel: k.yearLevel ? yearLevelLabel(k.yearLevel) : null,
    }));
  }
  const rememberedId = (await cookies()).get(SELECTED_CHILD_COOKIE)?.value ?? null;

  const sections: NavSection[] = SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.href === "/parent/messages") return { ...item, badge: messages };
      if (item.href === "/parent/notifications") {
        return { ...item, badge: notifications, badgeTone: "danger" as const };
      }
      return item;
    }),
  }));
  const searchDestinations: PortalSearchDestination[] = sections.flatMap((section) =>
    section.items.map((item) => ({ label: item.label, href: item.href, section: section.heading })),
  );
  const picker = (compact: boolean) =>
    kids.length > 1 ? (
      <Suspense>
        <ChildPicker kids={kids} rememberedId={rememberedId} compact={compact} />
      </Suspense>
    ) : null;

  return (
    <GlassPortalShell
      brand={<GlassBrandMark href="/parent" />}
      search={<PortalSearch destinations={searchDestinations} variant="sidebar" />}
      feature={picker(false)}
      nav={<GlassNavLinks sections={sections} />}
      account={
        <GlassAccount
          name={userName}
          roleLabel="Parent"
          avatar={<GlassInitial initial={userName.charAt(0).toUpperCase()} />}
        />
      }
      mobileHeader={
        <GlassMobileHeader
          brandHref="/parent"
          search={<PortalSearch destinations={searchDestinations} compact shortcutEnabled={false} />}
          extra={picker(true)}
          nav={<GlassNavLinksMobile sections={sections} />}
        />
      }
    >
      {children}
    </GlassPortalShell>
  );
}
