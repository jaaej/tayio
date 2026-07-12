import Link from "next/link";
import { desc } from "drizzle-orm";
import { Users, GraduationCap, UserCog, Baby } from "lucide-react";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import {
  Card,
  CardHead,
  CardBody,
  Pill,
  StatTile,
  PageHeader,
  Empty,
  Button,
  type PillTone,
  type StatTone,
} from "@/components/admin/ui";
import { CreateUserForm } from "./_components/create-user-form";
import { UserRowActions } from "./_components/user-row-actions";

export const dynamic = "force-dynamic";

const ROLE_TONE = {
  student: "brand",
  parent: "info",
  tutor: "good",
  admin: "warn",
} as const satisfies Record<string, PillTone>;

const STAT_META = {
  student: { tone: "brand", icon: <Users className="h-5 w-5" /> },
  parent: { tone: "sky", icon: <Baby className="h-5 w-5" /> },
  tutor: { tone: "mint", icon: <GraduationCap className="h-5 w-5" /> },
  admin: { tone: "coral", icon: <UserCog className="h-5 w-5" /> },
} as const satisfies Record<string, { tone: StatTone; icon: React.ReactNode }>;

export default async function UsersPage() {
  const rows = await db
    .select()
    .from(profiles)
    .orderBy(desc(profiles.createdAt));

  const grouped = {
    student: rows.filter((r) => coarseRole(r.role) === "student").length,
    parent: rows.filter((r) => coarseRole(r.role) === "parent").length,
    tutor: rows.filter((r) => coarseRole(r.role) === "tutor").length,
    admin: rows.filter((r) => coarseRole(r.role) === "admin").length,
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        className="rise"
        eyebrow="People"
        title="Users"
        sub="Accounts across all four portals."
        actions={
          <Link href="/admin/leaving">
            <Button variant="outline" size="md">
              Students leaving →
            </Button>
          </Link>
        }
      />

      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        {(["student", "parent", "tutor", "admin"] as const).map((role) => (
          <StatTile
            key={role}
            label={`${role}s`}
            value={grouped[role]}
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
            <CreateUserForm />
          </CardBody>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Card>
          <CardHead
            title="All accounts"
            action={<Pill tone="brand">{rows.length} total</Pill>}
          />
          {rows.length === 0 ? (
            <Empty>No accounts yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-2">
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Year / school</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-line hover:bg-surface-2 transition-colors"
                    >
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
                        {u.yearLevel ? `Yr ${u.yearLevel}` : "—"}
                        {u.school ? ` · ${u.school}` : ""}
                      </Td>
                      <Td>
                        <Pill tone={u.isActive ? "good" : "default"} dot>
                          {u.isActive ? "active" : "inactive"}
                        </Pill>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-muted font-bold ${className}`}
    >
      {children}
    </th>
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
