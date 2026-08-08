import Link from "next/link";
import { Users, GraduationCap, UserCog, Baby } from "lucide-react";
import type { UserRole } from "@/db/schema";
import { coarseRole, isUnrestrictedAdmin, type CoarseRole } from "@/lib/roles";
import { getCurrentUser } from "@/lib/auth";
import {
  directoryStatus,
  getUserDirectory,
  type DirectoryUser,
} from "@/app/admin/_lib/queries";
import { formatDateLong } from "@/lib/format";
import {
  Card,
  CardHead,
  CardBody,
  Pill,
  StatTile,
  PageHeader,
  Empty,
  type PillTone,
  type StatTone,
} from "@/components/admin/ui";
import { CreateUserForm } from "./_components/create-user-form";
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

  // Status + school scope the population; role only narrows which groups show,
  // so the stat tiles stay a useful summary of that population.
  const scoped = directory.filter(
    (u) =>
      (status === "all" || directoryStatus(u) === status) &&
      (!school || u.school === school),
  );

  const sorted = [...(roleFilter
    ? scoped.filter((u) => coarseRole(u.role) === roleFilter)
    : scoped)].sort((a, b) => {
    const cmp = `${a.firstName} ${a.lastName}`.localeCompare(
      `${b.firstName} ${b.lastName}`,
      undefined,
      { sensitivity: "base" },
    );
    return nameSort === "desc" ? -cmp : cmp;
  });

  const groups = ROLE_ORDER.map((role) => ({
    role,
    users: sorted.filter((u) => coarseRole(u.role) === role),
  })).filter((g) => g.users.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader className="rise" eyebrow="People" title="Users" />

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
            accent
          />
        ))}
      </section>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card accent="brand">
          <CardHead title="Create user" />
          <CardBody>
            <CreateUserForm canManagePrivilegedRoles={canManageRoles} />
          </CardBody>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Card>
          <CardHead title="Accounts" />
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
              {groups.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      <Empty>No accounts match these filters.</Empty>
                    </td>
                  </tr>
                </tbody>
              ) : (
                groups.map((g) => (
                  <tbody key={g.role}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={6}
                        className="text-left bg-brand-50 border-y border-line px-5 py-2.5"
                      >
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-brand-700">
                          {ROLE_LABEL[g.role]}
                        </span>
                        <span className="ml-2 text-[11px] font-bold text-muted tabular-nums">
                          {g.users.length}
                        </span>
                      </th>
                    </tr>
                    {g.users.map((u) => (
                      <UserRow key={u.id} user={u} />
                    ))}
                  </tbody>
                ))
              )}
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function UserRow({ user: u }: { user: DirectoryUser }) {
  const status = directoryStatus(u);

  return (
    <tr className="border-b border-line hover:bg-surface-2 transition-colors">
      <Td className="font-bold text-ink">
        <Link
          href={`/admin/users/${u.id}`}
          className="hover:text-brand-700 transition-colors"
        >
          {u.firstName} {u.lastName}
        </Link>
      </Td>
      <Td className="text-muted">{u.email}</Td>
      <Td>
        <Pill tone={ROLE_TONE[coarseRole(u.role)]}>{u.role}</Pill>
      </Td>
      <Td className="text-muted">
        {u.yearLevel ? `Yr ${u.yearLevel}` : "-"}
        {u.school ? ` · ${u.school}` : ""}
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
