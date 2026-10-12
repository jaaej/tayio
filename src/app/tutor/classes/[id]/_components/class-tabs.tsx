"use client";

import { usePathname } from "next/navigation";
import { SegmentedLinks } from "@/components/admin/ui";

/** The class page's tab row. A client component only to read the active tab
 * from the URL; the layout passes the counts. */
export function ClassTabs({
  classId,
  lessonsToFinish,
  rosterCount,
  changesRequested,
}: {
  classId: string;
  lessonsToFinish: number;
  rosterCount: number;
  changesRequested: number;
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
    { label: "Students", href: `${base}/students`, count: rosterCount },
    {
      label: "Announcements",
      href: `${base}/announcements`,
      count: changesRequested,
      countTone: "warn" as const,
    },
  ];
  return (
    <SegmentedLinks
      label="Class sections"
      size="md"
      className="max-w-full flex-wrap self-start"
      items={tabs.map((tab) => ({
        ...tab,
        active: pathname === tab.href || pathname.startsWith(`${tab.href}/`),
      }))}
    />
  );
}
