import type { ReactNode } from "react";
import {
  LayoutDashboard,
  BookOpen,
  SquarePen,
  FolderOpen,
  CalendarDays,
  ArrowLeftRight,
  CalendarCheck2,
  MessagesSquare,
  MessageCircle,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { getUnreadCount } from "@/lib/notifications";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { ProfileAvatar } from "@/components/profile-avatar";
import { signProfilePhoto } from "@/lib/profile-photo-storage";
import { GlassPortalShell } from "@/components/portal/glass-shell";
import {
  GlassNavLinks,
  GlassNavLinksMobile,
  type NavSection,
} from "@/components/portal/glass-nav-links";
import {
  GlassAccount,
  GlassBrandMark,
  GlassMobileHeader,
} from "@/components/portal/glass-chrome";
import {
  PortalSearch,
  type PortalSearchDestination,
} from "@/components/portal/global-search";
import { getPendingMarkCount, getTutorStudentsByClass } from "@/app/tutor/_data";
import { getClaimableCoverCount } from "@/app/tutor/_lib/nav-badges";
import { getPendingCheckinWeeks } from "@/app/tutor/checkin/_lib/queries";
import { studentSearchEntries } from "@/app/tutor/_lib/student-search";

const IC = "h-[17px] w-[17px]";

const SECTIONS: NavSection[] = [
  {
    heading: "Teaching",
    items: [
      { label: "Today", href: "/tutor", icon: <LayoutDashboard className={IC} /> },
      {
        label: "Classes",
        href: "/tutor/classes",
        icon: <BookOpen className={IC} />,
        // Quizzes open from their week in a class's week plan, and student
        // profiles from a class's Students roster.
        also: ["/tutor/quizzes", "/tutor/students"],
      },
      { label: "Marking", href: "/tutor/homework", icon: <SquarePen className={IC} /> },
      { label: "Resources", href: "/tutor/resources", icon: <FolderOpen className={IC} /> },
    ],
  },
  {
    heading: "Schedule",
    items: [
      {
        label: "Schedule & availability",
        href: "/tutor/timetable",
        icon: <CalendarDays className={IC} />,
      },
      { label: "Cover board", href: "/tutor/cover", icon: <ArrowLeftRight className={IC} /> },
      { label: "Weekly check-in", href: "/tutor/checkin", icon: <CalendarCheck2 className={IC} /> },
    ],
  },
  {
    heading: "Inbox",
    items: [
      { label: "Discussions", href: "/tutor/discussions", icon: <MessagesSquare className={IC} /> },
      { label: "Messages", href: "/tutor/messages", icon: <MessageCircle className={IC} /> },
      { label: "Notifications", href: "/tutor/notifications", icon: <Bell className={IC} /> },
    ],
  },
];

/** A failed badge query must never take the whole portal down. */
function settled(result: PromiseSettledResult<number>, label: string) {
  if (result.status === "fulfilled") return result.value;
  console.error(`[tutor-shell] ${label} count failed:`, result.reason);
  return 0;
}

/**
 * TutorShell - tutor portal chrome on the shared glass shell (same component
 * as admin, tutor nav config). `.theme-glass` scopes the palette and font.
 */
export async function TutorShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  const badges = { marking: 0, cover: 0, checkin: 0, messages: 0, notifications: 0 };
  let people: PortalSearchDestination[] = [];
  let profileAvatarKey: string | null = null;
  let profilePhotoUrl: string | null = null;
  if (user) {
    const [marking, cover, checkin, messages, notifications, avatarResult, roster] =
      await Promise.allSettled([
        getPendingMarkCount(user.id),
        getClaimableCoverCount(user.id),
        getPendingCheckinWeeks(user.id).then((weeks) => weeks.length),
        getUnreadThreadCount(user.id),
        getUnreadCount(user.id),
        db
          .select({
            avatarUrl: profiles.avatarUrl,
            profileAvatarKey: profiles.profileAvatarKey,
          })
          .from(profiles)
          .where(eq(profiles.id, user.id))
          .limit(1),
        getTutorStudentsByClass(user.id),
      ]);
    badges.marking = settled(marking, "marking");
    badges.cover = settled(cover, "cover");
    badges.checkin = settled(checkin, "check-in");
    badges.messages = settled(messages, "message");
    badges.notifications = settled(notifications, "notification");
    if (avatarResult.status === "fulfilled") {
      profileAvatarKey = avatarResult.value[0]?.profileAvatarKey ?? null;
      profilePhotoUrl = await signProfilePhoto(avatarResult.value[0]?.avatarUrl);
    } else {
      console.error("[tutor-shell] profile icon failed:", avatarResult.reason);
    }
    // Students are found by name in the search box (there is no student
    // list page; each class has its own roster).
    if (roster.status === "fulfilled") people = studentSearchEntries(roster.value.classes);
    else console.error("[tutor-shell] student search list failed:", roster.reason);
  }

  const BADGE_BY_HREF: Record<string, number> = {
    "/tutor/homework": badges.marking,
    "/tutor/cover": badges.cover,
    "/tutor/checkin": badges.checkin,
    "/tutor/messages": badges.messages,
  };
  const sections: NavSection[] = SECTIONS.map((s) => ({
    ...s,
    items: s.items.map((item) => {
      if (item.href === "/tutor/notifications") {
        return { ...item, badge: badges.notifications, badgeTone: "danger" as const };
      }
      const badge = BADGE_BY_HREF[item.href];
      return badge ? { ...item, badge } : item;
    }),
  }));
  const searchDestinations: PortalSearchDestination[] = [
    ...sections.flatMap((section) =>
      section.items.map((item) => ({
        label: item.label,
        href: item.href,
        section: section.heading,
      })),
    ),
    { label: "Profile", href: "/tutor/profile", section: "Account" },
  ];
  const initial = userName.charAt(0).toUpperCase();
  const avatar = (size: string) => (
    <ProfileAvatar
      avatarKey={profileAvatarKey}
      imageUrl={profilePhotoUrl}
      fallback={initial}
      className={size}
    />
  );

  return (
    <GlassPortalShell
      brand={<GlassBrandMark href="/tutor" />}
      search={
        <PortalSearch
          destinations={searchDestinations}
          people={people}
          variant="sidebar"
        />
      }
      nav={<GlassNavLinks sections={sections} />}
      account={
        <GlassAccount
          name={userName}
          roleLabel="Tutor"
          href="/tutor/profile"
          avatar={avatar("h-8 w-8 text-[13px]")}
        />
      }
      mobileHeader={
        <GlassMobileHeader
          brandHref="/tutor"
          search={
            <PortalSearch
              destinations={searchDestinations}
              people={people}
              compact
              shortcutEnabled={false}
            />
          }
          extra={
            <Link
              href="/tutor/profile"
              aria-label="Your profile"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {avatar("h-9 w-9 text-[12px]")}
            </Link>
          }
          nav={
            <GlassNavLinksMobile
              sections={sections}
              offMenuPages={[{ href: "/tutor/profile", label: "Profile" }]}
            />
          }
        />
      }
    >
      {children}
    </GlassPortalShell>
  );
}
