"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TabLinks } from "@/components/admin/ui";
import { withListQuery } from "../_lib/student-list";

/**
 * A link inside the students split view that carries the list's search and
 * year filter, read live from the URL. Search writes the URL without a server
 * round-trip, so these hrefs are built on the client rather than baked in
 * when the profile was rendered.
 */
export function ListLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const searchParams = useSearchParams();
  return <Link href={withListQuery(href, searchParams)} {...props} />;
}

/** The profile's section tabs, each keeping the list params. */
export function ProfileTabLinks({
  basePath,
  tabs,
}: {
  basePath: string;
  tabs: Array<{ key: string; label: string; active: boolean; count?: number }>;
}) {
  const searchParams = useSearchParams();
  return (
    <TabLinks
      label="Student sections"
      items={tabs.map((t) => ({
        label: t.label,
        count: t.count,
        // Overview is the default tab, so it gets the clean URL.
        href: withListQuery(
          basePath,
          searchParams,
          t.key === "overview" ? undefined : { tab: t.key },
        ),
        active: t.active,
      }))}
    />
  );
}
