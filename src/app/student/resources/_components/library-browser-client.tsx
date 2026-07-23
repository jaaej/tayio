"use client";

import { useMemo, useState } from "react";
import { FileText, Link2 as LinkIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/status-badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RESOURCE_TYPES, resourceTypeLabel, type ResourceTypeValue } from "@/lib/resource-types";
import type { AccentTokens } from "@/lib/subject-colors";
import { openResource } from "@/app/_actions/resources";

export type LibraryResourceItem = {
  id: string;
  title: string;
  type: string;
  kind: "file" | "link";
  topicId: string | null;
  topicName: string | null;
};

export type LibrarySubjectGroup = {
  subjectId: string;
  subjectName: string;
  tokens: AccentTokens;
  resources: LibraryResourceItem[];
};

export type LibraryTopicOption = { id: string; name: string; subjectName: string };

export function LibraryBrowserClient({
  groups,
  topicOptions,
}: {
  groups: LibrarySubjectGroup[];
  topicOptions: LibraryTopicOption[];
}) {
  const [type, setType] = useState<ResourceTypeValue | null>(null);
  const [topicId, setTopicId] = useState<string>("");
  const [query, setQuery] = useState("");

  const activeTypes = useMemo(() => {
    const present = new Set(groups.flatMap((g) => g.resources.map((r) => r.type)));
    return RESOURCE_TYPES.filter((t) => present.has(t.value));
  }, [groups]);

  const q = query.trim().toLowerCase();
  const filteredGroups = groups.map((g) => ({
    ...g,
    resources: g.resources.filter((r) => {
      if (type && r.type !== type) return false;
      if (topicId && r.topicId !== topicId) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    }),
  }));

  const totalResources = groups.reduce((n, g) => n + g.resources.length, 0);

  if (totalResources === 0) {
    return (
      <Card>
        <div className="py-6 text-sm text-ink-soft">
          No resources published yet.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={type === null} onClick={() => setType(null)}>
          All types
        </FilterChip>
        {activeTypes.map((t) => (
          <FilterChip
            key={t.value}
            active={type === t.value}
            onClick={() => setType((prev) => (prev === t.value ? null : t.value))}
          >
            {t.label}
          </FilterChip>
        ))}
        {topicOptions.length > 0 && (
          <Select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="h-9 w-auto max-w-[220px]"
            aria-label="Filter by topic"
          >
            <option value="">All topics</option>
            {topicOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.subjectName}
              </option>
            ))}
          </Select>
        )}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title…"
          className="h-9 w-auto max-w-[200px]"
          aria-label="Search resources by title"
        />
      </div>

      <div className="space-y-4">
        {filteredGroups.map((g) => (
          <Card key={g.subjectId} className="p-0 overflow-hidden">
            <div
              className="px-4 py-3 flex items-center gap-3 border-b border-hairline/60"
              style={{
                background: `linear-gradient(135deg, ${g.tokens.bgFrom} 0%, ${g.tokens.bgTo} 100%)`,
              }}
            >
              <div
                className="h-9 w-9 rounded-[10px] grid place-items-center text-[14px] font-extrabold shrink-0"
                style={{ background: g.tokens.title, color: "#fff" }}
              >
                {g.subjectName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[14px] font-extrabold leading-tight truncate"
                  style={{ color: g.tokens.title }}
                >
                  {g.subjectName}
                </div>
                <div
                  className="text-[10px] uppercase tracking-[0.12em] font-bold"
                  style={{ color: g.tokens.meta }}
                >
                  {g.resources.length} resource{g.resources.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            {g.resources.length === 0 ? (
              <div className="px-6 py-8 text-sm text-ink-soft">
                No resources match your filters.
              </div>
            ) : (
              <ul className="divide-y divide-hairline/60">
                {g.resources.map((r) => (
                  <ResourceRow key={r.id} resource={r} />
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
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
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-[0.1em] transition-colors",
        active
          ? "bg-brand-600 text-white"
          : "bg-brand-100 text-ink-soft hover:bg-brand-200",
      )}
    >
      {children}
    </button>
  );
}

function ResourceRow({ resource }: { resource: LibraryResourceItem }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const Icon = resource.kind === "link" ? LinkIcon : FileText;

  async function handleOpen() {
    setState("loading");
    const res = await openResource(resource.id);
    if (res.ok) {
      window.open(res.url, "_blank", "noopener,noreferrer");
      setState("idle");
    } else {
      setState("error");
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={handleOpen}
        disabled={state === "loading"}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-brand-50/60 transition-colors disabled:opacity-60"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ink font-medium truncate">{resource.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusBadge
              label={resourceTypeLabel(resource.type)}
              className="bg-brand-100 text-ink-soft"
            />
            {resource.topicName && (
              <span className="text-[11px] text-muted">{resource.topicName}</span>
            )}
          </div>
        </div>
        <span className="shrink-0 text-xs font-semibold text-brand-600">
          {state === "loading" ? "Opening…" : state === "error" ? "Try again" : "Open →"}
        </span>
      </button>
      {state === "error" && (
        <div className="px-6 pb-3 -mt-1 text-xs text-rose-700">
          Couldn't open this resource. Try again.
        </div>
      )}
    </li>
  );
}
