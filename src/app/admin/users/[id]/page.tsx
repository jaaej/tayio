import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { familyLinks, profiles } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateLong, formatTime } from "@/lib/format";
import { getStudentUpcomingLessons } from "@/app/admin/_lib/queries";
import { EditUserForm } from "./_components/edit-user-form";
import { FamilyLinksManager } from "./_components/family-links-manager";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reschedule?: string }>;
}) {
  const { id } = await params;
  const { reschedule } = await searchParams;

  const [user] = await db.select().from(profiles).where(eq(profiles.id, id));
  if (!user) notFound();

  const upcomingLessons =
    user.role === "student"
      ? await getStudentUpcomingLessons(id, 21)
      : [];

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
          className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
        >
          ← All users
        </Link>
      </div>

      <header className="rise flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            User profile
          </div>
          <h1 className="mt-2 text-4xl font-medium tracking-tight text-ink">
            {user.firstName} {user.lastName}
          </h1>
          <div className="mt-2 text-sm text-ink-soft">{user.email}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone="brand">{user.role}</Badge>
          <Badge tone={user.isActive ? "success" : "muted"}>
            {user.isActive ? "active" : "inactive"}
          </Badge>
          <a
            href={`/admin/messages/with/${user.id}`}
            className="mt-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors uppercase tracking-[0.14em]"
          >
            Message
          </a>
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

      {reschedule === "ok" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <div className="text-sm text-emerald-900">
            Reschedule saved. The original tutor, new tutor, and linked parents
            have been notified.
          </div>
        </Card>
      )}
      {reschedule === "error" && (
        <Card className="border-rose-200 bg-rose-50">
          <div className="text-sm text-rose-900">
            Couldn't save that reschedule. Try again.
          </div>
        </Card>
      )}

      {user.role === "student" && (
        <section className="rise" style={{ animationDelay: "100ms" }}>
          <Card>
            <CardLabel>Upcoming lessons</CardLabel>
            <p className="mt-1 mb-4 text-xs text-muted">
              Next 3 weeks. Click reschedule to move this student to a different
              slot (other enrolled students keep the original lesson).
            </p>
            {upcomingLessons.length === 0 ? (
              <div className="text-sm text-ink-soft">
                No upcoming lessons in the next 3 weeks.
              </div>
            ) : (
              <ul className="divide-y divide-hairline/60 -mx-2">
                {upcomingLessons.map((l) => (
                  <li
                    key={l.id}
                    className="px-2 py-3 flex items-center gap-3 flex-wrap"
                  >
                    <div className="min-w-[180px]">
                      <div className="text-sm font-medium text-ink">
                        {l.subjectName}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {l.className}
                      </div>
                    </div>
                    <div className="min-w-[140px] text-sm text-ink-soft tabular-nums">
                      {formatDateLong(l.date)}
                    </div>
                    <div className="min-w-[110px] text-sm text-ink-soft tabular-nums">
                      {formatTime(l.startTime)} – {formatTime(l.endTime)}
                    </div>
                    <div className="min-w-[140px] text-sm text-ink-soft">
                      {l.tutorFirstName} {l.tutorLastName}
                    </div>
                    {l.status !== "upcoming" && (
                      <Badge tone="muted">{l.status}</Badge>
                    )}
                    <Link
                      href={`/admin/users/${id}/reschedule/${l.id}`}
                      className="ml-auto rounded-lg border border-hairline/60 bg-card px-3 py-1.5 text-xs font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors uppercase tracking-[0.12em]"
                    >
                      Reschedule
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}

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
