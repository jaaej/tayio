import Link from "next/link";
import type { UserRole } from "@/db/schema";
import {
  coarseRole,
  isUnrestrictedAdmin,
  roleLabel,
  type CoarseRole,
} from "@/lib/roles";
import { getCurrentUser } from "@/lib/auth";
import {
  directoryStatus,
  getUserDirectory,
  type DirectoryUser,
} from "@/app/admin/_lib/queries";
import { formatDateLong, yearLevelLabel } from "@/lib/format";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import {
  accountScheduleStatusLabel,
  freeTrialDirectoryState,
} from "@/lib/account-schedule-status";
import { Pill, Empty, type PillTone } from "@/components/admin/ui";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { cn } from "@/lib/utils";
import { CreateUserPanel } from "./_components/create-user-panel";
import { UserRowActions } from "./_components/user-row-actions";
import { UserTableRow } from "./_components/user-table-row";
import { UserDirectoryControls } from "./_components/user-directory-controls";
import { UserNoteButton } from "./_components/user-note-button";
import { getSubjectSearchAliases } from "@/lib/subject-search-aliases";
import {
  directoryEntryMatches,
  matchingAliasSubjectIds,
} from "@/lib/directory-search";

export const dynamic = "force-dynamic";

/** Directory reading order: the people who run the centre, then the families. */
const ROLE_ORDER = ["admin", "tutor", "parent", "student"] as const;

const ROLE_LABEL = {
  admin: "Admins",
  tutor: "Tutors",
  parent: "Parents",
  student: "Students",
} as const satisfies Record<CoarseRole, string>;


const ROLE_TONE = {
  student: "brand",
  parent: "info",
  tutor: "good",
  admin: "warn",
} as const satisfies Record<CoarseRole, PillTone>;

const ROLE_DOT = {
  admin: "bg-warn",
  tutor: "bg-good",
  parent: "bg-info",
  student: "bg-brand-500",
} as const satisfies Record<CoarseRole, string>;

const ROLE_AVATAR = {
  admin: "bg-warn-bg text-warn",
  tutor: "bg-good-bg text-good",
  parent: "bg-info-bg text-info",
  student: "bg-brand-50 text-brand-700",
} as const satisfies Record<CoarseRole, string>;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    name?: string;
    school?: string;
    status?: string;
    q?: string;
    new?: string;
  }>;
}) {
  const sp = await searchParams;
  const roleFilter = (ROLE_ORDER as readonly string[]).includes(sp.role ?? "")
    ? (sp.role as CoarseRole)
    : null;
  const nameSort = sp.name === "desc" ? "desc" : "asc";
  const status =
    sp.status === "discontinued" || sp.status === "all" ? sp.status : "active";
  const school = sp.school || null;
  const query = (sp.q ?? "").trim().toLowerCase();

  const [directory, me, subjectAliases] = await Promise.all([
    getUserDirectory(),
    getCurrentUser(),
    getSubjectSearchAliases(),
  ]);
  const aliasSubjectIds = matchingAliasSubjectIds(
    subjectAliases.flatMap((entry) =>
      entry.alias ? [{ subjectId: entry.subjectId, alias: entry.alias }] : [],
    ),
    query,
  );
  const canManageRoles = isUnrestrictedAdmin(
    me?.app_metadata?.role as UserRole | undefined,
  );

  // Options come from the whole directory, never the filtered slice, so the
  // school currently in use never disappears from its own dropdown.
  const schools = Array.from(
    new Set(directory.map((u) => u.school).filter((s): s is string => !!s)),
  ).sort((a, b) => a.localeCompare(b));

  // Status + school scope the population the stat tiles summarise.
  const scoped = directory.filter(
    (u) =>
      (status === "all" || directoryStatus(u) === status) &&
      (!school || u.school === school),
  );

  // Role and the search box narrow the listing only. Both are deliberately
  // applied after `scoped`: a summary that rewrites itself as you type is not
  // a summary, so the tiles stay put while the table responds.
  const listed = scoped.filter(
    (u) =>
      (!roleFilter || coarseRole(u.role) === roleFilter) &&
      directoryEntryMatches(u, query, aliasSubjectIds),
  );

  const sorted = [...listed].sort((a, b) => {
    const cmp = `${a.firstName} ${a.lastName}`.localeCompare(
      `${b.firstName} ${b.lastName}`,
      undefined,
      { sensitivity: "base" },
    );
    return nameSort === "desc" ? -cmp : cmp;
  });

  // One flat list, still read in centre order (admins first, families last)
  // with the chosen name sort applied inside each of those runs. Every row
  // carries a role pill, so no group header is needed to tell them apart.
  const rows = ROLE_ORDER.flatMap((role) =>
    sorted.filter((u) => coarseRole(u.role) === role),
  );

  // Tiles keep every other filter (search, status, school, sort) and swap
  // only the role, so they act as the page's one role filter.
  const tileHref = (role: CoarseRole | null) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key !== "role" && key !== "new" && value) params.set(key, value);
    }
    if (role) params.set("role", role);
    const qs = params.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };
  const tiles: Array<{ key: CoarseRole | null; label: string; count: number; dot: string }> = [
    { key: null, label: "Everyone", count: scoped.length, dot: "bg-ink" },
    ...ROLE_ORDER.map((role) => ({
      key: role,
      label: ROLE_LABEL[role],
      count: scoped.filter((u) => coarseRole(u.role) === role).length,
      dot: ROLE_DOT[role],
    })),
  ];

  return (
    <div className="space-y-5">
      <header className="glass-frame rise flex flex-wrap items-center gap-3 rounded-[22px] px-5 py-4">
        <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">
          Users
        </h1>
        <div className="ml-auto">
          <CreateUserPanel
            canManagePrivilegedRoles={canManageRoles}
            defaultOpen={sp.new === "1"}
          />
        </div>
      </header>

      <nav
        aria-label="Filter by role"
        className="rise grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        style={{ animationDelay: "40ms" }}
      >
        {tiles.map((tile) => {
          const active = (roleFilter ?? null) === tile.key;
          return (
            <Link
              key={tile.label}
              href={tileHref(tile.key)}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className="glass-frame group block rounded-[20px] p-1.5 transition-transform duration-150 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <span className="flex items-center gap-2 px-2.5 pb-2 pt-1.5 text-[13px] font-bold text-ink">
                <span aria-hidden className={cn("h-2 w-2 rounded-full", tile.dot)} />
                {tile.label}
              </span>
              <span
                className={cn(
                  "block rounded-[14px] border px-4 py-3 text-[30px] font-extrabold tabular-nums leading-none tracking-[-0.02em] transition-colors",
                  active
                    ? "border-ink bg-ink text-white shadow-[0_10px_24px_-12px_rgba(14,17,22,0.6)]"
                    : "border-line/70 bg-surface text-ink group-hover:bg-surface-2",
                )}
              >
                {tile.count}
              </span>
            </Link>
          );
        })}
      </nav>

      <GlassPanel
        className="rise"
        title={roleFilter ? `All ${ROLE_LABEL[roleFilter].toLowerCase()}` : "All people"}
        action={<UserDirectoryControls schools={schools} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {["Name", "Role", "Classes", "Delivery", "Status"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-4 py-3 text-[12px] font-bold text-muted"
                    aria-sort={
                      h === "Name"
                        ? nameSort === "desc"
                          ? "descending"
                          : "ascending"
                        : undefined
                    }
                  >
                    {h}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <Empty>No accounts match these filters.</Empty>
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    canHardDelete={canManageRoles}
                    canManageAccount={
                      canManageRoles || coarseRole(u.role) !== "admin"
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}

function UserRow({
  user: u,
  canManageAccount,
  canHardDelete,
}: {
  user: DirectoryUser;
  canManageAccount: boolean;
  canHardDelete: boolean;
}) {
  const status = directoryStatus(u);
  const role = coarseRole(u.role);
  const today = melbourneDate(new Date());
  const scheduleStatus = u.schedulePeriod
    ? accountScheduleStatusLabel(u.schedulePeriod, today)
    : null;
  const trialState = freeTrialDirectoryState(u.trialPeriod, today);
  // This directory answers "what do they teach/study?". Collapse several
  // class slots for the same subject and keep weekday/session details on the
  // linked class page itself.
  const subjectBadges = Array.from(
    new Map(
      u.classInfo.map((item) => [item.subjectName.trim().toLowerCase(), item]),
    ).values(),
  );
  const yearSchool = [u.yearLevel ? yearLevelLabel(u.yearLevel) : null, u.school]
    .filter(Boolean)
    .join(" · ");
  const name = `${u.firstName} ${u.lastName}`.trim();

  return (
    <UserTableRow href={`/admin/users/${u.id}`}>
      <Td>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-extrabold",
              ROLE_AVATAR[role],
            )}
          >
            {u.firstName.charAt(0)}
            {u.lastName.charAt(0)}
          </span>
          <div className="min-w-0">
            <Link
              href={`/admin/users/${u.id}`}
              className="text-[14px] font-bold text-ink transition-colors hover:text-brand-700"
            >
              {name}
            </Link>
            <div className="truncate text-[13px] text-ink-soft">{u.email}</div>
            {yearSchool && (
              <div className="text-[12px] text-muted">{yearSchool}</div>
            )}
            {u.linkedFamily.length > 0 && (
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] text-muted">
                <span>{role === "parent" ? "Children:" : "Parents:"}</span>
                {u.linkedFamily.map((person, index) => (
                  <span key={person.id} className="inline-flex items-center gap-1">
                    {index > 0 && <span aria-hidden>·</span>}
                    <Link
                      href={`/admin/users/${person.id}`}
                      className="font-bold text-brand-700 hover:underline"
                    >
                      {person.name}
                    </Link>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Td>
      <Td>
        <span className="whitespace-nowrap">
          <Pill tone={ROLE_TONE[role]}>{roleLabel(u.role)}</Pill>
        </span>
      </Td>
      <Td>
        {subjectBadges.length === 0 ? (
          <span className="text-muted">-</span>
        ) : (
          <div className="flex min-w-[260px] max-w-[380px] flex-wrap gap-1.5">
            {subjectBadges.slice(0, 2).map((item) => (
              <Link
                key={item.id}
                href={`/admin/classes/${item.id}`}
                title={item.subjectName}
                className="inline-flex max-w-[200px] items-center truncate rounded-[8px] bg-surface-2 px-2.5 py-1 text-[12px] font-bold text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                {item.subjectName}
              </Link>
            ))}
            {subjectBadges.length > 2 && (
              <span
                title={subjectBadges
                  .slice(2)
                  .map((item) => item.subjectName)
                  .join(", ")}
                className="inline-flex items-center rounded-[8px] border border-dashed border-line-strong px-2 py-1 text-[12px] font-bold text-muted"
              >
                +{subjectBadges.length - 2}
              </span>
            )}
          </div>
        )}
      </Td>
      <Td className="whitespace-nowrap text-ink-soft">
        {u.deliveryModes.length === 0
          ? <span className="text-muted">-</span>
          : u.deliveryModes
              .map((mode) => (mode === "online" ? "Online" : "In person"))
              .join(", ")}
      </Td>
      <Td>
        <div className="flex flex-col items-start gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[13px] font-bold capitalize",
              status === "active" ? "text-good" : "text-muted",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full",
                status === "active" ? "bg-good" : "bg-muted",
              )}
            />
            {status}
          </span>
          {trialState && (
            <span
              title={
                u.trialPeriod
                  ? `Free trial: ${formatDateLong(u.trialPeriod.startDate)}–${formatDateLong(u.trialPeriod.endDate)}`
                  : undefined
              }
            >
              <Pill
                tone={
                  trialState === "current"
                    ? "info"
                    : trialState === "scheduled"
                      ? "brand"
                      : "default"
                }
              >
                {trialState === "current"
                  ? "Free trial"
                  : trialState === "scheduled"
                    ? "Trial scheduled"
                    : "Trial ended"}
              </Pill>
            </span>
          )}
          {scheduleStatus && u.schedulePeriod && (
            <span className="text-[12px] text-muted">
              <Pill
                tone={u.schedulePeriod.approval === "pending" ? "warn" : "info"}
              >
                {scheduleStatus}
              </Pill>{" "}
              <span className="tabular-nums">
                {formatDateLong(u.schedulePeriod.startDate)}–
                {formatDateLong(u.schedulePeriod.endDate)}
              </span>
            </span>
          )}
          {u.withdrawnClasses > 0 && u.lastWithdrawnAt && (
            <span className="text-[12px] text-muted">
              Left {u.withdrawnClasses} class
              {u.withdrawnClasses === 1 ? "" : "es"} ·{" "}
              <span className="tabular-nums">
                {formatDateLong(u.lastWithdrawnAt)}
              </span>
            </span>
          )}
        </div>
      </Td>
      <Td className="text-right">
        <div className="inline-flex items-center gap-1.5">
          <UserNoteButton
            userId={u.id}
            name={name}
            note={u.adminNote}
            canEdit={canManageAccount}
          />
          <UserRowActions
            id={u.id}
            email={u.email}
            isActive={u.isActive}
            name={name}
            canManageAccount={canManageAccount}
            canHardDelete={canHardDelete}
          />
        </div>
      </Td>
    </UserTableRow>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3.5 align-middle text-[13px] text-ink", className)}>
      {children}
    </td>
  );
}
