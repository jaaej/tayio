import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { CreateUserForm } from "./_components/create-user-form";
import { UserRowActions } from "./_components/user-row-actions";

export const dynamic = "force-dynamic";

const ROLE_TONE = {
  student: "brand",
  parent: "neutral",
  tutor: "success",
  admin: "warn",
} as const;

export default async function UsersPage() {
  const rows = await db
    .select()
    .from(profiles)
    .orderBy(desc(profiles.createdAt));

  const grouped = {
    student: rows.filter((r) => r.role === "student").length,
    parent: rows.filter((r) => r.role === "parent").length,
    tutor: rows.filter((r) => r.role === "tutor").length,
    admin: rows.filter((r) => r.role === "admin").length,
  };

  return (
    <div className="space-y-10">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          User management
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Everyone with{" "}
          <span className="font-display italic">portal access</span>.
        </h1>
        <p className="mt-3 text-sm text-ink-soft max-w-xl">
          Create accounts for students, parents, tutors, and fellow admins.
          Deactivating an account revokes their login until you re-enable it.
        </p>
      </header>

      <section className="grid sm:grid-cols-4 gap-4 rise">
        {(["student", "parent", "tutor", "admin"] as const).map((role) => (
          <Card key={role}>
            <CardLabel>{role}s</CardLabel>
            <div className="mt-2 text-3xl font-light text-ink">
              {grouped[role]}
            </div>
          </Card>
        ))}
      </section>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardLabel>Create user</CardLabel>
          <div className="mt-4">
            <CreateUserForm />
          </div>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Year / school</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <TR>
                <TD colSpan={6} className="text-center text-muted py-8">
                  No accounts yet.
                </TD>
              </TR>
            )}
            {rows.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="hover:text-brand-700"
                  >
                    {u.firstName} {u.lastName}
                  </Link>
                </TD>
                <TD className="text-ink-soft">{u.email}</TD>
                <TD>
                  <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                </TD>
                <TD className="text-ink-soft">
                  {u.yearLevel ? `Yr ${u.yearLevel}` : "—"}
                  {u.school ? ` · ${u.school}` : ""}
                </TD>
                <TD>
                  <Badge tone={u.isActive ? "success" : "muted"}>
                    {u.isActive ? "active" : "inactive"}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <UserRowActions
                    id={u.id}
                    email={u.email}
                    isActive={u.isActive}
                    name={`${u.firstName} ${u.lastName}`}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
