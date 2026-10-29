"use client";

import { useEffect, useMemo, useRef } from "react";
import { StickyNote } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Empty,
  ListPane,
  ListPaneGroup,
  ListPaneRow,
  ListPaneTitle,
  SegmentedLinks,
} from "@/components/admin/ui";
import { initialsOf } from "@/components/admin/ui/glass";
import { matchingAliasSubjectIds, type SubjectAlias } from "@/lib/directory-search";
import type { CoarseRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  ROLE_ORDER,
  ROLE_PLURAL,
  filterDirectory,
  groupDirectory,
  parseRoleParam,
  parseStatusParam,
  withListQuery,
  type DirectoryListItem,
  type RowFlag,
} from "../_lib/directory-list";
import { CreateUserPanel } from "./create-user-panel";
import { UserDirectoryControls } from "./user-directory-controls";
import { ROLE_AVATAR } from "./role-style";

const FLAG = {
  info: "bg-info-bg text-info",
  good: "bg-good-bg text-good",
} as const satisfies Record<RowFlag["tone"], string>;

/**
 * The left pane of the users split view. It lives in the users layout, so it
 * stays mounted (scroll position and all) while the admin moves between
 * profiles; the role tab, search and filters live in the URL and are read
 * here, and every row link carries them along.
 */
export function UserDirectoryPane({
  items,
  schools,
  aliases,
  canManagePrivilegedRoles,
}: {
  items: DirectoryListItem[];
  schools: string[];
  aliases: SubjectAlias[];
  canManagePrivilegedRoles: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scroller = useRef<HTMLDivElement>(null);

  const selectedId = /^\/admin\/users\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const role = parseRoleParam(searchParams.get("role"));
  const status = parseStatusParam(searchParams.get("status"));
  const school = searchParams.get("school") || null;
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const sort = searchParams.get("name") === "desc" ? "desc" : "asc";

  const groups = useMemo(() => {
    const aliasIds = matchingAliasSubjectIds(aliases, query);
    const listed = filterDirectory(items, { role, status, school, query }, aliasIds);
    return groupDirectory(listed, role, sort);
  }, [items, aliases, role, status, school, query, sort]);
  const listedCount = groups.reduce((n, g) => n + g.people.length, 0);

  // A deep link to a profile lands with the list scrolled to the top; bring
  // the selected row into view once, inside the list's own scroller.
  useEffect(() => {
    const box = scroller.current;
    const row = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !row) return;
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 2 + row.offsetHeight / 2;
    }
    // Mount only: later selections are clicks on rows already in view.
  }, []);

  // Role tabs keep the open profile and every other param.
  const roleHref = (next: CoarseRole | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    if (next) params.set("role", next);
    else params.delete("role");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <ListPane
      labelledBy="users-list-heading"
      hiddenBelowXl={Boolean(selectedId)}
      scrollRef={scroller}
      header={
        <>
          <div className="flex items-center justify-between gap-3">
            <ListPaneTitle id="users-list-heading" count={listedCount}>
              Users
            </ListPaneTitle>
            <CreateUserPanel
              canManagePrivilegedRoles={canManagePrivilegedRoles}
              defaultOpen={searchParams.get("new") === "1"}
            />
          </div>
          <UserDirectoryControls schools={schools} />
          <SegmentedLinks
            label="Filter by role"
            stretch
            items={[
              { label: "All", href: roleHref(null), active: role === null },
              ...ROLE_ORDER.map((r) => ({
                label: ROLE_PLURAL[r],
                href: roleHref(r),
                active: role === r,
              })),
            ]}
          />
        </>
      }
    >
      {groups.length === 0 ? (
        <Empty>No one matches these filters.</Empty>
      ) : (
        groups.map((group) => (
          <ListPaneGroup
            key={group.key}
            id={`users-group-${group.key}`}
            label={group.label}
          >
            {group.people.map((person) => (
              <li key={person.id}>
                <PersonRow
                  person={person}
                  href={withListQuery(`/admin/users/${person.id}`, searchParams)}
                  selected={person.id === selectedId}
                />
              </li>
            ))}
          </ListPaneGroup>
        ))
      )}
    </ListPane>
  );
}

function PersonRow({
  person,
  href,
  selected,
}: {
  person: DirectoryListItem;
  href: string;
  selected: boolean;
}) {
  const name = `${person.firstName} ${person.lastName}`.trim();
  return (
    <ListPaneRow href={href} selected={selected}>
      <span
        aria-hidden
        className={cn(
          "grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[12px] font-extrabold",
          ROLE_AVATAR[person.role],
        )}
      >
        {initialsOf(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-bold">{name}</span>
        <span className="truncate text-[12px] text-muted">
          {person.status === "discontinued" ? "Discontinued · " : ""}
          {person.sub}
        </span>
        {person.note && (
          <span
            className="mt-0.5 flex min-w-0 items-center gap-1 text-[12px] text-ink-soft"
            title={person.note}
          >
            <StickyNote className="h-3 w-3 shrink-0 text-muted" aria-hidden />
            <span className="sr-only">Internal note: </span>
            <span className="truncate">{person.note}</span>
          </span>
        )}
      </span>
      {person.flag && (
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-[7px] text-[10px] font-extrabold uppercase",
            FLAG[person.flag.tone],
          )}
        >
          {person.flag.label}
        </span>
      )}
    </ListPaneRow>
  );
}
