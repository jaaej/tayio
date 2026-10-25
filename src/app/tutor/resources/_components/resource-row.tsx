"use client";

import {
  OpenerTrigger,
  useResourceOpener,
  type OpenableResource,
} from "@/components/resources/resource-opener";
import { ResourceTypeChip } from "@/components/resources/resource-type-chip";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { cn } from "@/lib/utils";
import { ShareToggle } from "./share-toggle";

/**
 * One row of the tutor's library. The title and "Open →" both open the
 * resource in the portal's viewer, as a student's or parent's row does;
 * "Open →" is the keyboard stop.
 */
export function TutorResourceRow({
  resource,
  type,
  topicName,
  meta,
  isShared,
}: {
  resource: OpenableResource;
  type: string;
  topicName: string | null;
  meta: string;
  isShared: boolean;
}) {
  const opener = useResourceOpener(resource);
  const { state } = opener;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-[#F8F9FC] md:grid-cols-[110px_minmax(0,1fr)_170px_140px_84px]">
      <span className="col-span-2 md:col-span-1">
        <ResourceTypeChip type={type} />
      </span>
      <span className="col-span-2 flex min-w-0 flex-col md:col-span-1">
        <OpenerTrigger
          opener={opener}
          tabIndex={-1}
          className="min-w-0 truncate text-left text-[14px] font-bold text-ink hover:text-brand-600 hover:underline disabled:cursor-wait"
        >
          <span title={resource.title}>{resource.title}</span>
        </OpenerTrigger>
        {topicName && <span className="truncate text-[12px] text-muted">{topicName}</span>}
      </span>
      <span className="col-span-2 text-[12px] text-muted md:col-span-1">{meta}</span>
      <ShareToggle id={resource.id} isShared={isShared} title={resource.title} />
      <OpenerTrigger
        opener={opener}
        label={`Open ${resource.title}`}
        className={cn(
          "inline-flex min-h-11 items-center justify-end justify-self-end whitespace-nowrap rounded-[10px] px-1 text-[13px] font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-wait",
          state === "error" ? "text-bad" : "text-brand-600",
        )}
      >
        <ActionButtonLabel pending={state === "loading"} pendingLabel="Opening…">
          {state === "error" ? "Try again" : "Open →"}
        </ActionButtonLabel>
      </OpenerTrigger>
      {opener.viewer}
    </li>
  );
}
