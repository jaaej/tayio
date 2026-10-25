"use client";

import {
  OpenerTrigger,
  useResourceOpener,
  type OpenableResource,
} from "@/components/resources/resource-opener";
import { ResourceTypeChip } from "@/components/resources/resource-type-chip";
import { ShareToggle } from "./share-toggle";

/**
 * One row of the tutor's library. The title opens the resource in the
 * portal's viewer, as a student's, parent's or admin's row does.
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
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-[#F8F9FC] md:grid-cols-[110px_minmax(0,1fr)_170px_140px]">
      <span className="col-span-2 md:col-span-1">
        <ResourceTypeChip type={type} />
      </span>
      <span className="col-span-2 flex min-w-0 flex-col md:col-span-1">
        <OpenerTrigger
          opener={opener}
          className="min-w-0 self-start truncate rounded-[6px] text-left text-[14px] font-bold text-ink underline-offset-2 hover:text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-wait"
        >
          <span title={resource.title}>{resource.title}</span>
          {state === "loading" && <span className="font-semibold text-muted"> · Opening…</span>}
        </OpenerTrigger>
        {topicName && <span className="truncate text-[12px] text-muted">{topicName}</span>}
        {state === "error" && (
          <span role="alert" className="text-[12px] text-bad">
            Couldn&apos;t open this resource. Try again.
          </span>
        )}
      </span>
      <span className="col-span-2 text-[12px] text-muted md:col-span-1">{meta}</span>
      <ShareToggle id={resource.id} isShared={isShared} title={resource.title} />
      {opener.viewer}
    </li>
  );
}
