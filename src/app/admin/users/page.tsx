import Link from "next/link";
import { Users, GraduationCap, UserCog, Baby } from "lucide-react";
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
import { formatDateLong } from "@/lib/format";
import {
  Card,
  Pill,
  StatTile,
  PageHeader,
  Empty,
  FilterToolbar,
  type FilterPill,
  type PillTone,
  type StatTone,
} from "@/components/admin/ui";
import { CreateUserPanel } from "./_components/create-user-panel";
import { UserRowActions } from "./_components/user-row-actions";
import { UserTableHeaderRow } from "./_components/user-table-filters";
import { UserMobileFilters } from "./_components/user-mobile-filters";

export const dynamic = "force-dynamic";

/** Directory reading order: the people who run the centre, then the families. */
const ROLE_ORDER = ["admin", "tutor", "parent", "student"] as const;

const ROLE_LABEL = {
  admin: "Admins",
  tutor: "Tutors",
  parent: "Parents",
  student: "Students",
} as const satisfies Record<CoarseRole, string>;

const ROLE_PILLS: FilterPill[] = [
  { value: "", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "tutor", label: "Tutors" },
  { value: "parent", label: "Parents" },
  { value: "student", label: "Students" },
];

const ROLE_TONE = {
  student: "brand",
  parent: "info",
  tutor: "good",
  admin: "warn",
} as const satisfies Record<CoarseRole, PillTone>;

const STAT_META = {
  admin: { tone: "coral", icon: <UserCog className="h-5 w-5" /> },
  tutor: { tone: "mint", icon: <GraduationCap className="h-5 w-5" /> },
  parent: { tone: "sky", icon: <Baby className="h-5 w-5" /> },
  student: { tone: "brand", icon: <Users className="h-5 w-5" /> },
} as const satisfies Record<CoarseRole, { tone: StatTone; icon: React.ReactNode }>;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    name?: string;
    school?: string;
    status?: string;
    q?: string;
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

  const [directory, me] = await Promise.all([
    getUserDirectory(),
    getCurrentUser(),
  ]);
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
      (!query ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.classInfo.some(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.subjectName.toLowerCase().includes(query),
        )),
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

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="People"
        title="Users"
        actions={<CreateUserPanel canManagePrivilegedRoles={canManageRoles} />}
      />

      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        {ROLE_ORDER.map((role) => (
          <StatTile
            key={role}
            label={ROLE_LABEL[role]}
            value={scoped.filter((u) => coarseRole(u.role) === role).length}
            icon={STAT_META[role].icon}
            tone={STAT_META[role].tone}
          />
        ))}
      </section>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
          {/* Search and role live at the top of the table's own card: they are
              the table's controls, not a separate surface to look in. */}
          <FilterToolbar
            searchPlaceholder="Search name, email, class, or subject"
            pillParam="role"
            pills={ROLE_PILLS}
          />
          {/* Below lg the header filter controls scroll off with the table, so
              this collapsible sheet is the reachable filter home on mobile. */}
          <div className="p-4 pb-0 lg:hidden">
            <UserMobileFilters schools={schools} />
          </div>
          {/* The table always renders: the filters now live in its header, so
              hiding it on an empty result would strip away the only controls
              that can undo the filter. */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <UserTableHeaderRow schools={schools} />
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <Empty>No accounts match these filters.</Empty>
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      canManageAccount={
                        canManageRoles || coarseRole(u.role) !== "admin"
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function UserRow({
  user: u,
  canManageAccount,
}: {
  user: DirectoryUser;
  canManageAccount: boolean;
}) {
  const status = directoryStatus(u);
  // This directory answers "what do they teach/study?". Collapse several
  // class slots for the same subject and keep weekday/session details on the
  // linked class page itself.
  const subjectBadges = Array.from(
    new Map(
      u.classInfo.map((item) => [item.subjectName.trim().toLowerCase(), item]),
    ).values(),
  );

  return (
    <tr className="border-b border-line hover:bg-surface-2 transition-colors">
      <Td className="font-bold text-ink">
        <Link
          href={`/admin/users/${u.id}`}
          className="hover:text-brand-700 transition-colors"
        >
          {u.firstName} {u.lastName}
        </Link>
        {u.linkedFamily.length > 0 && (
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] font-medium text-muted">
            <span>{coarseRole(u.role) === "parent" ? "Children:" : "Parents:"}</span>
            {u.linkedFamily.map((person, index) => (
              <span key={person.id} className="inline-flex items-center gap-1">
                {index > 0 && <span aria-hidden>·</span>}
                <Link
                  href={`/admin/users/${person.id}`}
                  className="font-bold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  {person.name}
                </Link>
              </span>
            ))}
          </div>
        )}
        {u.adminNotes.length > 0 && (
          <div className="mt-2 space-y-1">
            {u.adminNotes.slice(0, 2).map((item) => (
              <div
                key={item.classId}
                title={`${item.className}: ${item.note}`}
                className="max-w-[300px] rounded-[8px] border border-warn/25 bg-warn-bg px-2.5 py-1.5 text-[11px] font-medium leading-snug text-warn"
              >
                <span className="font-bold">Note · {item.className}:</span>{" "}
                <span className="line-clamp-2">{item.note}</span>
              </div>
            ))}
            {u.adminNotes.length > 2 && (
              <span className="block text-[10px] font-bold text-muted">
                +{u.adminNotes.length - 2} more note
                {u.adminNotes.length - 2 === 1 ? "" : "s"} in profile
              </span>
            )}
          </div>
        )}
      </Td>
      <Td className="text-muted">{u.email}</Td>
      <Td>
        <Pill tone={ROLE_TONE[coarseRole(u.role)]}>{roleLabel(u.role)}</Pill>
      </Td>
      <Td className="text-muted">
        {u.yearLevel ? `Yr ${u.yearLevel}` : "-"}
        {u.school ? ` · ${u.school}` : ""}
      </Td>
      <Td>
        {u.classInfo.length === 0 && u.deliveryModes.length === 0 ? (
          <span className="text-muted">-</span>
        ) : (
          <div className="min-w-[210px] space-y-1.5">
            {subjectBadges.length > 0 && (
              <div className="flex max-w-[330px] flex-wrap gap-1">
                {subjectBadges.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    href={`/admin/classes/${item.id}`}
                    title={item.subjectName}
                    className="inline-flex max-w-[210px] items-center truncate rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 hover:border-brand-400 hover:bg-brand-100"
                  >
                    {item.subjectName}
                  </Link>
                ))}
                {subjectBadges.length > 3 && (
                  <span className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-muted">
                    +{subjectBadges.length - 3} more
                  </span>
                )}
              </div>
            )}
            {u.deliveryModes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {u.deliveryModes.map((mode) => (
                  <Pill key={mode} tone={mode === "online" ? "info" : "mint"}>
                    {mode === "online" ? "Online" : "In person"}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        )}
      </Td>
      <Td>
        <div className="flex flex-col items-start gap-1">
          <Pill tone={status === "active" ? "good" : "default"} dot>
            {status}
          </Pill>
          {u.withdrawnClasses > 0 && u.lastWithdrawnAt && (
            <span className="text-[11px] text-muted">
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
        <UserRowActions
          id={u.id}
          email={u.email}
          isActive={u.isActive}
          name={`${u.firstName} ${u.lastName}`}
          canManageAccount={canManageAccount}
        />
      </Td>
    </tr>
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
    <td className={`px-5 py-3 text-[13px] text-ink align-middle ${className}`}>
      {children}
    </td>
  );
}
