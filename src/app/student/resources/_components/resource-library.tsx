"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Empty } from "@/components/admin/ui";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { RESOURCE_TYPES, resourceTypeLabel, type ResourceTypeValue } from "@/lib/resource-types";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import type {
  ResourceLibraryItem,
  ResourceLibrarySubject,
  ResourceLibraryTopic,
} from "@/lib/resource-library";

type OpenResourceAction = (
  id: string,
) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;

/** Type tag colours from the StudentResourcesPage handoff. */
const TYPE_TONE: Record<string, { bg: string; fg: string }> = {
  worksheet: { bg: "#DDF3EE", fg: "#0B5C4E" },
  notes: { bg: "#EEEBFD", fg: "#3A1AA8" },
  video: { bg: "#E7EFFD", fg: "#1E4FB8" },
  past_paper: { bg: "#FBE8F1", fg: "#9D2C61" },
  writing_template: { bg: "#FDF1E0", fg: "#8A4A06" },
  answer_sheet: { bg: "#E3F4EC", fg: "#15803D" },
  formula_sheet: { bg: "#EEEFF6", fg: "#4A4660" },
  exam_guide: { bg: "#FDE8E8", fg: "#B42318" },
};

/**
 * The student's resource library: type chips above one glass section per
 * subject. The title search lives in the page header and reaches this list
 * through `?q=`.
 */
export function ResourceLibrary({
  subjects,
  topics,
  openAction,
}: {
  subjects: ResourceLibrarySubject[];
  topics: ResourceLibraryTopic[];
  openAction: OpenResourceAction;
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
          <div className="panel overflow-hidden">
            {s.resources.length === 0 ? (
              <Empty className="py-7">No resources match your filters.</Empty>
            ) : (
              <ul>
                {s.resources.map((r) => (
                  <ResourceRow key={r.id} resource={r} openAction={openAction} />
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

function ResourceRow({
  resource,
  openAction,
}: {
  resource: ResourceLibraryItem;
  openAction: OpenResourceAction;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const tone = TYPE_TONE[resource.type] ?? TYPE_TONE.formula_sheet;

  async function open() {
    setState("loading");
    try {
      const res = await openAction(resource.id);
      if (!res.ok) throw new Error(res.error);
      window.open(res.url, "_blank", "noopener,noreferrer");
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={open}
        disabled={state === "loading"}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left text-ink transition-colors hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 disabled:cursor-wait sm:grid-cols-[100px_minmax(0,1fr)_auto] lg:grid-cols-[100px_minmax(0,1fr)_160px_auto]"
      >
        <span className="hidden sm:block">
          <span
            className="inline-flex h-[22px] max-w-full items-center truncate rounded-[11px] px-2 text-[11px] font-extrabold"
            style={{ backgroundColor: tone.bg, color: tone.fg }}
          >
            {resourceTypeLabel(resource.type)}
          </span>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-bold">{resource.title}</span>
          <span className="truncate text-[12px] text-muted">
            <span className="sm:hidden">{resourceTypeLabel(resource.type)}</span>
            {resource.topicName && (
              <>
                <span className="sm:hidden"> · </span>
                {resource.topicName}
              </>
            )}
            <span className="lg:hidden"> · {resource.meta}</span>
          </span>
        </span>
        <span className="hidden text-[12px] text-muted lg:block">{resource.meta}</span>
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
      </button>
      {state === "error" && (
        <p role="alert" className="-mt-1 px-4 pb-3 text-[12px] text-bad">
          Couldn&apos;t open this resource. Try again.
        </p>
      )}
    </li>
  );
}
