"use client";

import {
  OpenerTrigger,
  useResourceOpener,
  type OpenableResource,
} from "@/components/resources/resource-opener";

/** A moderation row's title: opens the resource in the portal's viewer, as every library does. */
export function AdminResourceTitle({ resource }: { resource: OpenableResource }) {
  const opener = useResourceOpener(resource);
  return (
    <>
      <OpenerTrigger
        opener={opener}
        className="text-left text-[14px] font-bold text-ink underline-offset-2 hover:text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-wait"
      >
        {resource.title}
        {opener.state === "loading" && <span className="font-semibold text-muted"> · Opening…</span>}
      </OpenerTrigger>
      {opener.state === "error" && (
        <span role="alert" className="text-[12px] text-bad">
          Couldn&apos;t open this resource. Try again.
        </span>
      )}
      {opener.viewer}
    </>
  );
}
