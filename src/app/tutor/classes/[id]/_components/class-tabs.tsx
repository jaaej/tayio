"use client";

import { usePathname } from "next/navigation";
import { HeroBackIcon, HeroTabs } from "@/components/subjects/subject-hero";

/** The class page's tab row on the coloured class hero, after the back
 * button. A client component only to read the active tab from the URL; the
 * hero passes the counts. */
export function ClassTabs({
  classId,
  lessonsToFinish,
  rosterCount,
  changesRequested,
  fg,
}: {
  classId: string;
  lessonsToFinish: number;
  rosterCount: number;
  changesRequested: number;
  /** The subject's `fg`, for the selected tab and the back button. */
  fg: string;
}) {
  const pathname = usePathname();
  const base = `/tutor/classes/${classId}`;
  const tabs = [
    { label: "Week plan", href: `${base}/curriculum` },
    {
      label: "Lessons",
      href: `${base}/lessons`,
      count: lessonsToFinish,
      countTone: "warn" as const,
    },
    {
      label: "Students",
      href: `${base}/students`,
      count: rosterCount,
      countTone: "neutral" as const,
    },
    {
      label: "Announcements",
      href: `${base}/announcements`,
      count: changesRequested,
      countTone: "warn" as const,
    },
  ];
  return (
    <HeroTabs
      label="Class sections"
      fg={fg}
      leading={<HeroBackIcon href="/tutor/classes" label="All classes" fg={fg} />}
      items={tabs.map((tab) => ({
        ...tab,
        active: pathname === tab.href || pathname.startsWith(`${tab.href}/`),
      }))}
    />
  );
}
