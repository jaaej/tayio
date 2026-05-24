import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { familyLinks, profiles } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditUserForm } from "./_components/edit-user-form";
import { FamilyLinksManager } from "./_components/family-links-manager";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user] = await db.select().from(profiles).where(eq(profiles.id, id));
  if (!user) notFound();

  const allStudents = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
    })
    .from(profiles)
    .where(eq(profiles.role, "student"));

  const allParents = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
    })
    .from(profiles)
    .where(eq(profiles.role, "parent"));

  let parents: typeof allParents = [];
  let children: typeof allStudents = [];

  if (user.role === "student") {
    const linkedParent = alias(profiles, "linked_parent");
    parents = await db
      .select({
        id: linkedParent.id,
        firstName: linkedParent.firstName,
        lastName: linkedParent.lastName,
        email: linkedParent.email,
      })
      .from(familyLinks)
      .innerJoin(linkedParent, eq(linkedParent.id, familyLinks.parentId))
      .where(eq(familyLinks.studentId, user.id));
  }

  if (user.role === "parent") {
    const linkedStudent = alias(profiles, "linked_student");
    children = await db
      .select({
        id: linkedStudent.id,
        firstName: linkedStudent.firstName,
        lastName: linkedStudent.lastName,
        email: linkedStudent.email,
      })
      .from(familyLinks)
      .innerJoin(linkedStudent, eq(linkedStudent.id, familyLinks.studentId))
      .where(eq(familyLinks.parentId, user.id));
  }

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/users"
          className="text-xs uppercase tracking-[0.16em] text-brand-700 hover:text-brand-600"
        >
          ← All users
        </Link>
      </div>

      <header className="rise flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            User profile
          </div>
          <h1 className="mt-2 text-4xl font-light tracking-tight text-ink">
            {user.firstName} {user.lastName}
          </h1>
          <div className="mt-2 text-sm text-ink-soft">{user.email}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone="brand">{user.role}</Badge>
          <Badge tone={user.isActive ? "success" : "muted"}>
            {user.isActive ? "active" : "inactive"}
          </Badge>
        </div>
      </header>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardLabel>Profile</CardLabel>
          <div className="mt-4">
            <EditUserForm
              id={user.id}
              firstName={user.firstName}
              lastName={user.lastName}
              phone={user.phone ?? ""}
              yearLevel={user.yearLevel ?? ""}
              school={user.school ?? ""}
              role={user.role}
            />
          </div>
        </Card>
      </section>

      {(user.role === "parent" || user.role === "student") && (
        <section className="rise" style={{ animationDelay: "120ms" }}>
          <Card>
            <CardLabel>
              {user.role === "parent" ? "Children" : "Parents"}
            </CardLabel>
            <div className="mt-4">
              <FamilyLinksManager
                viewer={user.role}
                userId={user.id}
                existing={
                  user.role === "parent"
                    ? children.map((c) => ({
                        id: c.id,
                        name: `${c.firstName} ${c.lastName}`,
                        email: c.email,
                      }))
                    : parents.map((p) => ({
                        id: p.id,
                        name: `${p.firstName} ${p.lastName}`,
                        email: p.email,
                      }))
                }
                options={
                  user.role === "parent"
                    ? allStudents.map((s) => ({
                        id: s.id,
                        name: `${s.firstName} ${s.lastName}`,
                        email: s.email,
                      }))
                    : allParents.map((p) => ({
                        id: p.id,
                        name: `${p.firstName} ${p.lastName}`,
                        email: p.email,
                      }))
                }
              />
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
