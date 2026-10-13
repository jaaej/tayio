import type { ReactNode } from "react";
import Link from "next/link";
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
  Library,
  Zap,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadThreadCount } from "@/lib/dm-queries";
import { getUnreadCount } from "@/lib/notifications";
import { getOverallBlitzRank, getStudentYearLevel } from "@/app/student/math-game/_queries";
import { getDueHomeworkCount } from "@/app/student/_lib/queries";
import { yearLevelLabel } from "@/lib/format";
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

const IC = "h-[17px] w-[17px]";

const SECTIONS: NavSection[] = [
  {
    heading: "Learning",
    items: [
      { label: "Dashboard", href: "/student", icon: <LayoutDashboard className={IC} /> },
      { label: "My subjects", href: "/student/subjects", icon: <BookOpen className={IC} /> },
      { label: "Homework", href: "/student/homework", icon: <ClipboardList className={IC} /> },
      { label: "Timetable", href: "/student/timetable", icon: <CalendarDays className={IC} /> },
      { label: "Progress", href: "/student/progress", icon: <TrendingUp className={IC} /> },
      { label: "Resources", href: "/student/resources", icon: <Library className={IC} /> },
      { label: "Discussions", href: "/student/discussions", icon: <MessagesSquare className={IC} /> },
    ],
  },
  {
    heading: "Inbox",
    items: [
      { label: "Messages", href: "/student/messages", icon: <MessageCircle className={IC} /> },
      { label: "Notifications", href: "/student/notifications", icon: <Bell className={IC} /> },
    ],
  },
];

const BLITZ_HREF = "/student/math-game";

/** A failed badge query must never take the whole portal down. */
function settled<T>(result: PromiseSettledResult<T>, label: string, fallback: T): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[student-shell] ${label} failed:`, result.reason);
  return fallback;
}

/** Taiyo Blitz tile between search and the menu (student handoff design). */
function BlitzFeature({ rank }: { rank: { rank: number } | null }) {
  return (
    <Link
      href={BLITZ_HREF}
      title="Taiyo Blitz"
      className="portal-feature mx-1 mb-0.5 flex items-center gap-2.5 rounded-[14px] bg-ink px-3 py-2.5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
    >
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/[0.14]"
      >
        <Zap className="h-[17px] w-[17px] text-[#FFD66B]" strokeWidth={2} />
      </span>
      <span className="portal-feature-text flex min-w-0 flex-1 flex-col leading-[1.2]">
        <span className="text-[14px] font-extrabold">Taiyo Blitz</span>
        <span className="text-[11px] opacity-75">Play &amp; climb the board</span>
      </span>
      {rank && (
        <span className="portal-feature-text flex h-[22px] items-center rounded-[11px] bg-[#FFD66B] px-2 text-[11px] font-extrabold text-ink">
          #{rank.rank}
        </span>
      )}
    </Link>
  );
}

/**
 * StudentShell - student portal chrome on the shared glass shell (same
 * component as admin and tutor, student nav config).
 */
export async function StudentShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  let messages = 0;
  let notifications = 0;
  let homeworkDue = 0;
  let yearLevel: string | null = null;
  let blitzRank: Awaited<ReturnType<typeof getOverallBlitzRank>> = null;
  let profileAvatarKey: string | null = null;
  let profilePhotoUrl: string | null = null;
  if (user) {
    const [messageResult, notificationResult, rankResult, avatarResult, homeworkResult, yearResult] =
      await Promise.allSettled([
        getUnreadThreadCount(user.id),
        getUnreadCount(user.id),
        getOverallBlitzRank(user.id),
        db
          .select({
            avatarUrl: profiles.avatarUrl,
            profileAvatarKey: profiles.profileAvatarKey,
          })
          .from(profiles)
          .where(eq(profiles.id, user.id))
          .limit(1),
        getDueHomeworkCount(user.id),
        getStudentYearLevel(user.id),
      ]);
    homeworkDue = settled(homeworkResult, "homework count", 0);
    yearLevel = settled(yearResult, "year level", null);
    messages = settled(messageResult, "message count", 0);
    notifications = settled(notificationResult, "notification count", 0);
    blitzRank = settled(rankResult, "Taiyo Blitz rank", null);
    const avatar = settled(avatarResult, "profile icon", []);
    profileAvatarKey = avatar[0]?.profileAvatarKey ?? null;
    profilePhotoUrl = await signProfilePhoto(avatar[0]?.avatarUrl);
  }

  // Unrestricted students self-manage billing, so they get a Payments link.
  const isUnrestricted =
    (user?.app_metadata?.role as string | undefined) === "student_unrestricted";
  const sections: NavSection[] = SECTIONS.map((section) => {
    const items =
      isUnrestricted && section.heading === "Inbox"
        ? [
            ...section.items,
            { label: "Payments", href: "/student/payments", icon: <CreditCard className={IC} /> },
          ]
        : section.items;
    return {
      ...section,
      items: items.map((item) => {
        if (item.href === "/student/messages") return { ...item, badge: messages };
        if (item.href === "/student/homework") return { ...item, badge: homeworkDue };
        if (item.href === "/student/notifications") {
          return { ...item, badge: notifications, badgeTone: "danger" as const };
        }
        return item;
      }),
    };
  });
  // Phones have no sidebar, so Taiyo Blitz joins the menu there.
  const mobileSections: NavSection[] = [
    ...sections,
    {
      heading: "Play",
      items: [{ label: "Taiyo Blitz", href: BLITZ_HREF, icon: <Zap className={IC} /> }],
    },
  ];
  const searchDestinations: PortalSearchDestination[] = [
    ...mobileSections.flatMap((section) =>
      section.items.map((item) => ({
        label: item.label,
        href: item.href,
        section: section.heading,
      })),
    ),
    { label: "Profile", href: "/student/profile", section: "Account" },
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
      brand={<GlassBrandMark href="/student" />}
      search={<PortalSearch destinations={searchDestinations} variant="sidebar" />}
      feature={<BlitzFeature rank={blitzRank} />}
      nav={<GlassNavLinks sections={sections} />}
      account={
        <GlassAccount
          name={userName}
          roleLabel={
            isUnrestricted
              ? "Student · billing access"
              : yearLevel
                ? `Student · ${yearLevelLabel(yearLevel)}`
                : "Student"
          }
          href="/student/profile"
          avatar={avatar("h-8 w-8 text-[13px]")}
        />
      }
      mobileHeader={
        <GlassMobileHeader
          brandHref="/student"
          search={
            <PortalSearch
              destinations={searchDestinations}
              compact
              shortcutEnabled={false}
            />
          }
          extra={
            <Link
              href="/student/profile"
              aria-label="Your profile"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {avatar("h-9 w-9 text-[12px]")}
            </Link>
          }
          nav={
            <GlassNavLinksMobile
              sections={mobileSections}
              offMenuPages={[{ href: "/student/profile", label: "Profile" }]}
            />
          }
        />
      }
    >
      {children}
    </GlassPortalShell>
  );
}
