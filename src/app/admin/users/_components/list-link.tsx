"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TabLinks } from "@/components/admin/ui";
import { withListQuery } from "../_lib/directory-list";

/**
 * A link inside the users split view that carries the list's current role,
 * search and filters, read live from the URL. Search writes the URL without
 * a server round-trip, so these hrefs are built on the client rather than
 * baked in when the profile was rendered.
 */
export function ListLink({
  href,
  extra,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  extra?: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  return <Link href={withListQuery(href, searchParams, extra)} {...props} />;
}

/** The profile's section tabs, each keeping the list params. */
export function ProfileTabLinks({
  basePath,
  tabs,
}: {
  basePath: string;
  tabs: Array<{ key: string; label: string; active: boolean }>;
}) {
  const searchParams = useSearchParams();
  return (
    <TabLinks
      label="Profile sections"
      items={tabs.map((t) => ({
        label: t.label,
        // Profile is the default tab, so it gets the clean URL.
        href: withListQuery(
          basePath,
          searchParams,
          t.key === "profile" ? undefined : { tab: t.key },
        ),
        active: t.active,
      }))}
    />
  );
}
