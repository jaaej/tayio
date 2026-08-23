import type { ReactNode } from "react";
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
import { StudentTrialManager } from "./_components/student-trial-manager";
import { getReportTerms, getStudentTrial } from "@/app/admin/_lib/queries";
import { parseTabParam, type UserTab } from "@/lib/user-detail-tabs";
import { UserTabs } from "./_components/user-tabs";
import { AtAGlance } from "./_components/at-a-glance";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reschedule?: string; tab?: string; month?: string }>;
}) {
  const { id } = await params;
  const { reschedule, tab } = await searchParams;

  const [user] = await db.select().from(profiles).where(eq(profiles.id, id));
  if (!user) notFound();

  // Parsed against the role, so a stale cross-role link falls back to Profile
  // instead of rendering an empty panel.
  const activeTab = parseTabParam(tab, user.role);

  const me = await getCurrentUser();
  const canManageRoles = isUnrestrictedAdmin(
    me?.app_metadata?.role as UserRole | undefined,
  );

  const isStudent = coarseRole(user.role) === "student";
  const upcomingLessons = isStudent
    ? await getStudentUpcomingLessons(id, 21)
    : [];
  const [
    creditActivity,
    allowanceSummary,
    enrolledSubjects,
    leavePeriods,
    reportTerms,
    trial,
  ] = isStudent
    ? await Promise.all([
        getStudentActivity(id),
        getStudentAllowanceSummary(id),
        getStudentEnrolledSubjects(id),
        getStudentLeave(id),
        getReportTerms(),
        getStudentTrial(id),
      ])
    : [null, null, null, null, [], null];

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

  const initials =
    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  const profileCard = (
    <section className="rise" style={{ animationDelay: "80ms" }}>
      <Card>
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
  );

  const upcomingLessonsCard = coarseRole(user.role) === "student" && (
    <section className="rise" style={{ animationDelay: "100ms" }}>
      <Card>
        <CardHead
          title="Upcoming lessons"
          action={<span className="text-[12px] text-muted">Next 3 weeks</span>}
        />
        {upcomingLessons.length === 0 ? (
          <Empty>No upcoming lessons in the next 3 weeks.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {/* Grid, not flex-wrap: with wrap every row lays itself out
                independently, so nothing lines up column to column, and a
                squeezed cell breaks "Year 10 Maths" across three lines.
                Fixed tracks keep the columns honest and let long names
                truncate instead. Stacks to one column below sm. */}
            {upcomingLessons.map((l) => (
              <div
                key={l.id}
                className="grid grid-cols-1 gap-y-1 px-5 py-3.5 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1.5fr)_9.5rem_9.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4 sm:gap-y-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-bold text-ink">
                    {l.subjectName}
                  </div>
                  <div className="truncate text-[12px] text-muted">
                    {l.className}
                  </div>
                </div>
                <div className="text-[13px] text-ink-soft tabular-nums">
                  {formatDateLong(l.date)}
                </div>
                <div className="text-[13px] text-ink-soft tabular-nums">
                  {formatTime(l.startTime)} – {formatTime(l.endTime)}
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] text-ink-soft">
                    {l.tutorFirstName} {l.tutorLastName}
                  </span>
                  {l.status !== "upcoming" && (
                    <Pill tone="default">{l.status}</Pill>
                  )}
                </div>
                <Link
                  href={`/admin/users/${id}/reschedule/${l.id}`}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 justify-self-start rounded-full border border-line-strong bg-surface px-3.5 text-[12px] font-bold text-ink-soft transition-colors hover:bg-surface-2 hover:text-brand-700 sm:justify-self-end"
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
  );

  const leaveCard = isStudent && (
    <section className="rise" style={{ animationDelay: "110ms" }}>
      <Card>
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
  );

  const trialCard = isStudent && (
    <section className="rise" style={{ animationDelay: "115ms" }}>
      <Card>
        <CardHead
          title="Free trial"
          action={
            <span className="text-[12px] text-muted">
              Tutors see a trial pill
            </span>
          }
        />
        <CardBody>
          <StudentTrialManager studentId={user.id} trial={trial ?? null} />
        </CardBody>
      </Card>
    </section>
  );

  const reportsCard = isStudent && (
    <section className="rise" style={{ animationDelay: "120ms" }}>
      <Card>
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
  );

  const creditsCard = isStudent &&
    creditActivity &&
    allowanceSummary &&
    enrolledSubjects && (
      <CreditManagement
        studentId={user.id}
        activity={creditActivity}
        subjects={enrolledSubjects}
        summary={allowanceSummary}
      />
    );

  // Lives in the rail, not a tab: on a student record the linked parents are
  // reference information you want beside whatever you are editing.
  const familyCard = (coarseRole(user.role) === "parent" ||
    coarseRole(user.role) === "student") && (
    <section className="rise" style={{ animationDelay: "120ms" }}>
      <Card>
        <CardHead title={user.role === "parent" ? "Children" : "Parents"} />
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
  );

  // The tutor and availability panels are built in Task 4b.
  const panels: Record<UserTab, ReactNode> = {
    profile: (
      <>
        {profileCard}
        {trialCard}
      </>
    ),
    lessons: (
      <>
        {upcomingLessonsCard}
        {leaveCard}
      </>
    ),
    credits: creditsCard,
    reports: reportsCard,
    tutor: <></>,
    availability: <></>,
  };

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

      {/* Above the tabs: the reschedule action redirects back here without a
          tab, so the outcome must be visible whichever panel is showing. */}
      {reschedule === "ok" && (
        <Card>
          <CardBody className="text-[13px] text-good font-medium">
            Reschedule saved. The original tutor, new tutor, and linked parents
            have been notified.
          </CardBody>
        </Card>
      )}
      {reschedule === "error" && (
        <Card>
          <CardBody className="text-[13px] text-bad font-medium">
            Couldn't save that reschedule. Try again.
          </CardBody>
        </Card>
      )}

      <UserTabs
        active={activeTab}
        role={user.role}
        basePath={`/admin/users/${id}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">{panels[activeTab]}</div>
        <aside className="space-y-6">
          <AtAGlance
            rows={[
              { label: "Status", value: user.isActive ? "Active" : "Inactive" },
              { label: "Role", value: user.role },
              ...(isStudent
                ? [
                    { label: "Year level", value: user.yearLevel ?? "Not set" },
                    { label: "School", value: user.school ?? "Not set" },
                  ]
                : []),
              { label: "Phone", value: user.phone ?? "Not provided" },
              ...(isStudent
                ? [
                    {
                      label: "Free trial",
                      value: trial ? "On trial" : "Not on trial",
                    },
                  ]
                : []),
            ]}
          />
          {familyCard}
        </aside>
      </div>
    </div>
  );
}
