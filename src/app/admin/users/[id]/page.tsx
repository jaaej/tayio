import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { CalendarClock } from "lucide-react";
import { db } from "@/db/client";
import { familyLinks, profiles, type UserRole } from "@/db/schema";
import { STUDENT_TIERS, coarseRole, isUnrestrictedAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/auth";
import { alias } from "drizzle-orm/pg-core";
import {
  Card,
  CardHead,
  CardBody,
  Pill,
  Hero,
  HeroChip,
  BackLink,
  Empty,
} from "@/components/admin/ui";
import { formatDateLong, formatTime } from "@/lib/format";
import {
  getStudentUpcomingLessons,
  getStudentLeave,
} from "@/app/admin/_lib/queries";
import {
  getStudentActivity,
  getStudentAllowanceSummary,
  getStudentEnrolledSubjects,
} from "@/lib/admin-credits";
import { EditUserForm } from "./_components/edit-user-form";
import { FamilyLinksManager } from "./_components/family-links-manager";
import { CreditManagement } from "./_components/credit-management";
import { StudentLeaveManager } from "./_components/student-leave-manager";
import { StudentReportControls } from "./_components/student-report-controls";
import { getReportTerms } from "@/app/admin/_lib/queries";

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

  const me = await getCurrentUser();
  const canManageRoles = isUnrestrictedAdmin(
    me?.app_metadata?.role as UserRole | undefined,
  );

  const isStudent = coarseRole(user.role) === "student";
  const upcomingLessons = isStudent
    ? await getStudentUpcomingLessons(id, 21)
    : [];
  const [creditActivity, allowanceSummary, enrolledSubjects, leavePeriods, reportTerms] =
    isStudent
      ? await Promise.all([
          getStudentActivity(id),
          getStudentAllowanceSummary(id),
          getStudentEnrolledSubjects(id),
          getStudentLeave(id),
          getReportTerms(),
        ])
      : [null, null, null, null, []];

  const allStudents = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
    })
    .from(profiles)
    .where(inArray(profiles.role, STUDENT_TIERS));

  const allParents = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
    })
    .from(profiles)
    .where(eq(profiles.role, "parent"));

  type LinkedPerson = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isPrimaryContact: boolean;
  };
  let parents: LinkedPerson[] = [];
  let children: LinkedPerson[] = [];

  if (coarseRole(user.role) === "student") {
    const linkedParent = alias(profiles, "linked_parent");
    parents = await db
      .select({
        id: linkedParent.id,
        firstName: linkedParent.firstName,
        lastName: linkedParent.lastName,
        email: linkedParent.email,
        isPrimaryContact: familyLinks.isPrimaryContact,
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
        isPrimaryContact: familyLinks.isPrimaryContact,
      })
      .from(familyLinks)
      .innerJoin(linkedStudent, eq(linkedStudent.id, familyLinks.studentId))
      .where(eq(familyLinks.parentId, user.id));
  }

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="space-y-6">
      <BackLink href="/admin/users">All users</BackLink>

      <Hero
        className="rise"
        eyebrow="User profile"
        icon={initials}
        title={`${user.firstName} ${user.lastName}`}
        chips={
          <>
            <HeroChip>{user.role}</HeroChip>
            <HeroChip>{user.isActive ? "Active" : "Inactive"}</HeroChip>
            <HeroChip>{user.email}</HeroChip>
          </>
        }
        right={
          <a
            href={`/admin/messages/with/${user.id}`}
            className="inline-flex items-center rounded-full bg-white/[0.18] border border-white/30 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-white hover:bg-white/25 transition-colors"
          >
            Message
          </a>
        }
      />

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card accent="brand">
          <CardHead title="Profile" />
          <CardBody>
            <EditUserForm
              id={user.id}
              firstName={user.firstName}
              lastName={user.lastName}
              phone={user.phone ?? ""}
              yearLevel={user.yearLevel ?? ""}
              school={user.school ?? ""}
              role={user.role}
              canManageRoles={canManageRoles}
            />
          </CardBody>
        </Card>
      </section>

      {reschedule === "ok" && (
        <Card accent="good">
          <CardBody className="text-[13px] text-good font-medium">
            Reschedule saved. The original tutor, new tutor, and linked parents
            have been notified.
          </CardBody>
        </Card>
      )}
      {reschedule === "error" && (
        <Card accent="bad">
          <CardBody className="text-[13px] text-bad font-medium">
            Couldn't save that reschedule. Try again.
          </CardBody>
        </Card>
      )}

      {coarseRole(user.role) === "student" && (
        <section className="rise" style={{ animationDelay: "100ms" }}>
          <Card>
            <CardHead
              title="Upcoming lessons"
              action={
                <span className="text-[12px] text-muted">Next 3 weeks</span>
              }
            />
            {upcomingLessons.length === 0 ? (
              <Empty>No upcoming lessons in the next 3 weeks.</Empty>
            ) : (
              <div className="divide-y divide-line">
                {upcomingLessons.map((l) => (
                  <div
                    key={l.id}
                    className="px-5 py-3.5 flex items-center gap-3 flex-wrap hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-[180px]">
                      <div className="text-[14px] font-bold text-ink">
                        {l.subjectName}
                      </div>
                      <div className="text-[12px] text-muted truncate">
                        {l.className}
                      </div>
                    </div>
                    <div className="min-w-[140px] text-[13px] text-ink-soft tabular-nums">
                      {formatDateLong(l.date)}
                    </div>
                    <div className="min-w-[110px] text-[13px] text-ink-soft tabular-nums">
                      {formatTime(l.startTime)} – {formatTime(l.endTime)}
                    </div>
                    <div className="min-w-[140px] text-[13px] text-ink-soft">
                      {l.tutorFirstName} {l.tutorLastName}
                    </div>
                    {l.status !== "upcoming" && (
                      <Pill tone="default">{l.status}</Pill>
                    )}
                    <Link
                      href={`/admin/users/${id}/reschedule/${l.id}`}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:bg-surface-2 hover:text-brand-700 transition-colors"
                    >
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                      Reschedule
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      )}

      {isStudent && (
        <section className="rise" style={{ animationDelay: "110ms" }}>
          <Card accent="brand">
            <CardHead
              title="Leave / holidays"
              action={
                <span className="text-[12px] text-muted">
                  Away from all classes
                </span>
              }
            />
            <CardBody>
              <StudentLeaveManager
                studentId={user.id}
                periods={leavePeriods ?? []}
              />
            </CardBody>
          </Card>
        </section>
      )}

      {isStudent && (
        <section className="rise" style={{ animationDelay: "120ms" }}>
          <Card accent="brand">
            <CardHead
              title="Term reports"
              action={
                <span className="text-[12px] text-muted">PDF + notify family</span>
              }
            />
            <CardBody>
              <StudentReportControls
                studentId={user.id}
                terms={(reportTerms ?? []).map((t) => ({
                  id: t.id,
                  label: t.label,
                }))}
              />
            </CardBody>
          </Card>
        </section>
      )}

      {isStudent && creditActivity && allowanceSummary && enrolledSubjects && (
        <CreditManagement
          studentId={user.id}
          activity={creditActivity}
          subjects={enrolledSubjects}
          summary={allowanceSummary}
        />
      )}

      {(coarseRole(user.role) === "parent" || coarseRole(user.role) === "student") && (
        <section className="rise" style={{ animationDelay: "120ms" }}>
          <Card>
            <CardHead
              title={user.role === "parent" ? "Children" : "Parents"}
            />
            <CardBody>
              <FamilyLinksManager
                viewer={coarseRole(user.role) as "parent" | "student"}
                userId={user.id}
                existing={
                  user.role === "parent"
                    ? children.map((c) => ({
                        id: c.id,
                        name: `${c.firstName} ${c.lastName}`,
                        email: c.email,
                        isPrimaryContact: c.isPrimaryContact,
                      }))
                    : parents.map((p) => ({
                        id: p.id,
                        name: `${p.firstName} ${p.lastName}`,
                        email: p.email,
                        isPrimaryContact: p.isPrimaryContact,
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
            </CardBody>
          </Card>
        </section>
      )}
    </div>
  );
}
