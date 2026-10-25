"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Empty } from "@/components/admin/ui";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { OpenerTrigger, useResourceOpener } from "@/components/resources/resource-opener";
import { ResourceTypeChip } from "@/components/resources/resource-type-chip";
import { RESOURCE_TYPES, resourceTypeLabel, type ResourceTypeValue } from "@/lib/resource-types";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import type {
  ResourceLibraryItem,
  ResourceLibrarySubject,
  ResourceLibraryTopic,
} from "@/lib/resource-library";

/**
 * The resource library, the same for a student (their subjects) and a
 * parent (all their children's subjects): type chips above one glass section
 * per subject. The title search lives in the page header and reaches this
 * list through `?q=`. A row opens its resource in the portal's viewer
 * (`useResourceOpener`), as in the tutor and admin libraries.
 */
export function ResourceLibrary({
  subjects,
  topics,
}: {
  subjects: ResourceLibrarySubject[];
  topics: ResourceLibraryTopic[];
}) {
  const [type, setType] = useState<ResourceTypeValue | null>(null);
  const [topicId, setTopicId] = useState("");
  const q = (useSearchParams().get("q") ?? "").trim().toLowerCase();

  const presentTypes = useMemo(() => {
    const present = new Set(subjects.flatMap((s) => s.resources.map((r) => r.type)));
    return RESOURCE_TYPES.filter((t) => present.has(t.value));
  }, [subjects]);

  const total = subjects.reduce((n, s) => n + s.resources.length, 0);
  if (total === 0) {
    return (
      <section className="glass rounded-[24px] p-1.5">
        <div className="panel">
          <Empty>No resources published yet.</Empty>
        </div>
      </section>
    );
  }

  const filtered = subjects.map((s) => ({
    ...s,
    resources: s.resources.filter(
      (r) =>
        (!type || r.type === type) &&
        (!topicId || r.topicId === topicId) &&
        (!q || r.title.toLowerCase().includes(q)),
    ),
  }));

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-1.5">
        <TypeChip active={type === null} onClick={() => setType(null)}>
          All types
        </TypeChip>
        {presentTypes.map((t) => (
          <TypeChip
            key={t.value}
            active={type === t.value}
            onClick={() => setType((prev) => (prev === t.value ? null : t.value))}
          >
            {t.label}
          </TypeChip>
        ))}
        {topics.length > 0 && (
          <label className="relative max-w-full">
            <span className="sr-only">Topic</span>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="h-[34px] max-w-[220px] appearance-none truncate rounded-[17px] border border-white/95 bg-white/70 pl-3 pr-8 text-[13px] font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.subjectName}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink"
              aria-hidden
            />
          </label>
        )}
      </div>

      {filtered.map((s) => (
        <section
          key={s.subjectId}
          aria-labelledby={`library-${s.subjectId}`}
          className="glass rounded-[24px] p-1.5"
        >
          <div className="flex items-center gap-2.5 pb-2 pl-3 pr-1.5 pt-1.5">
            <span
              aria-hidden
              className="h-[9px] w-[9px] rounded-[3px]"
              style={{ backgroundColor: subjectTone(s.subjectName, s.subjectColor).dot }}
            />
            <h2 id={`library-${s.subjectId}`} className="text-[16px] font-extrabold text-ink">
              {s.subjectName}
            </h2>
            <span className="text-[13px] font-semibold text-ink-soft">
              {s.resources.length} resource{s.resources.length === 1 ? "" : "s"}
            </span>
          </div>
          {/* Rows lay out by the panel's width, not the screen's: the student
              page shares the row with class recordings. */}
          <div className="panel @container overflow-hidden">
            {s.resources.length === 0 ? (
              <Empty className="py-7">
                {type || topicId || q ? "No resources match your filters." : "Nothing in this subject yet."}
              </Empty>
            ) : (
              <ul>
                {s.resources.map((r) => (
                  <ResourceRow key={r.id} resource={r} />
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-[34px] rounded-[17px] border px-3 text-[13px] font-bold transition-[filter] hover:brightness-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        active
          ? "border-ink bg-ink text-white"
          : "border-white/95 bg-white/70 text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ResourceRow({ resource }: { resource: ResourceLibraryItem }) {
  const opener = useResourceOpener(resource);
  const { state } = opener;
  const rowClass =
    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left text-ink transition-colors hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 disabled:cursor-wait @md:grid-cols-[100px_minmax(0,1fr)_auto] @2xl:grid-cols-[100px_minmax(0,1fr)_160px_auto]";
  const content = (
    <>
      <span className="hidden @md:block">
        <ResourceTypeChip type={resource.type} className="max-w-full truncate" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="line-clamp-2 break-words text-[14px] font-bold" title={resource.title}>
          {resource.title}
        </span>
        {/* What the row's own columns don't show yet: the type below the
            chip column, the meta below the meta column. */}
        <span className="truncate text-[12px] text-muted">
          <span className="@md:hidden">
            {[resourceTypeLabel(resource.type), resource.topicName, resource.meta].filter(Boolean).join(" · ")}
          </span>
          <span className="hidden @md:inline @2xl:hidden">
            {[resource.topicName, resource.meta].filter(Boolean).join(" · ")}
          </span>
          {resource.topicName && <span className="hidden @2xl:inline">{resource.topicName}</span>}
        </span>
      </span>
      <span className="hidden text-[12px] text-muted @2xl:block">{resource.meta}</span>
      <span
        className={cn(
          "inline-flex min-w-[84px] items-center justify-end whitespace-nowrap text-[13px] font-bold",
          state === "error" ? "text-bad" : "text-brand-600",
        )}
      >
        <ActionButtonLabel pending={state === "loading"} pendingLabel="Opening…">
          {state === "error" ? "Try again" : "Open →"}
        </ActionButtonLabel>
      </span>
    </>
  );

  return (
    <li className="border-b border-line last:border-b-0">
      <OpenerTrigger opener={opener} className={rowClass}>
        {content}
      </OpenerTrigger>
      {state === "error" && (
        <p role="alert" className="-mt-1 px-4 pb-3 text-[12px] text-bad">
          Couldn&apos;t open this resource. Try again.
        </p>
      )}
      {opener.viewer}
    </li>
  );
}
