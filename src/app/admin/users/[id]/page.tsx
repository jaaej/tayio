import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { familyLinks, profiles, type UserRole } from "@/db/schema";
import { STUDENT_TIERS, coarseRole, isUnrestrictedAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/auth";
import { alias } from "drizzle-orm/pg-core";
import {
  Card,
  CardHead,
  CardBody,
  Hero,
  HeroChip,
  BackLink,
  Empty,
} from "@/components/admin/ui";
import {
  getStudentLeave,
  getStudentLessonsInRange,
  getTutorRecord,
  getTutorAvailabilityForTutor,
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
import { TutorBankForm } from "@/app/admin/tutors/_components/tutor-bank-form";
import { TutorAvailabilityEditor } from "@/app/admin/tutors/availability/_components/availability-editor";
import { parseTabParam, type UserTab } from "@/lib/user-detail-tabs";
import { UserTabs } from "./_components/user-tabs";
import { AtAGlance } from "./_components/at-a-glance";
import { AdminLessonCalendar } from "./_components/lesson-calendar";
import {
  monthBounds,
  parseMonthParam,
} from "@/app/student/_components/month-calendar";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const { id } = await params;
  const { tab, month } = await searchParams;

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
  const { year: calendarYear, month: calendarMonth } = parseMonthParam(month);
  const { fromIso } = monthBounds(calendarYear, calendarMonth);
  const calendarEnd = new Date(calendarYear, calendarMonth + 1, 0);
  const toIso = `${calendarEnd.getFullYear()}-${String(calendarEnd.getMonth() + 1).padStart(2, "0")}-${String(calendarEnd.getDate()).padStart(2, "0")}`;
  const [
    creditActivity,
    allowanceSummary,
    enrolledSubjects,
    leavePeriods,
    reportTerms,
    trial,
    calendarLessons,
  ] = isStudent
    ? await Promise.all([
        getStudentActivity(id),
        getStudentAllowanceSummary(id),
        getStudentEnrolledSubjects(id),
        getStudentLeave(id),
        getReportTerms(),
        getStudentTrial(id),
        getStudentLessonsInRange(id, fromIso, toIso),
      ])
    : [null, null, null, null, [], null, []];

  // canManageRoles is isUnrestrictedAdmin: it decides whether the bank row is
  // fetched at all, so a reception admin never receives payroll PII.
  const isTutor = coarseRole(user.role) === "tutor";
  const [tutorRecord, tutorAvailability] = isTutor
    ? await Promise.all([
        getTutorRecord(id, canManageRoles),
        getTutorAvailabilityForTutor(id),
      ])
    : [null, null];

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

  const lessonCalendar = isStudent && (
    <section className="rise" style={{ animationDelay: "100ms" }}>
      <Card>
        <CardBody>
          <AdminLessonCalendar
            studentId={id}
            year={calendarYear}
            month={calendarMonth}
            lessons={calendarLessons}
            leavePeriods={leavePeriods ?? []}
            basePath={`/admin/users/${id}`}
          />
        </CardBody>
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

  const tutorClassesCard = tutorRecord && (
    <section className="rise" style={{ animationDelay: "80ms" }}>
      <Card>
        <CardHead title="Classes" />
        {tutorRecord.classes.length === 0 ? (
          <Empty>Not assigned to any classes yet.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {tutorRecord.classes.map((c) => (
              <Link
                key={c.id}
                href={`/admin/classes/${c.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-bold text-ink">
                    {c.name}
                  </div>
                  <div className="truncate text-[12px] text-muted">
                    {c.subjectName}
                  </div>
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-ink-soft tabular-nums">
                  {c.studentCount}{" "}
                  {c.studentCount === 1 ? "student" : "students"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </section>
  );

  // Owner-only: tutor_bank_details is payroll PII. Reception gets nothing here
  // rather than a locked placeholder - gate, don't dangle.
  const tutorBankCard = tutorRecord && canManageRoles && (
    <section className="rise" style={{ animationDelay: "100ms" }}>
      <Card>
        <CardHead title="Payroll details" />
        <CardBody>
          <TutorBankForm tutorId={id} initial={tutorRecord.bank} />
        </CardBody>
      </Card>
    </section>
  );

  const tutorAvailabilityCard = tutorAvailability && (
    <section className="rise" style={{ animationDelay: "80ms" }}>
      <Card>
        <CardHead title="Weekly availability" />
        <CardBody>
          <TutorAvailabilityEditor
            tutorId={id}
            subjects={tutorAvailability.subjects}
            slots={tutorAvailability.slots}
          />
        </CardBody>
      </Card>
    </section>
  );

  const panels: Record<UserTab, ReactNode> = {
    profile: (
      <>
        {profileCard}
        {trialCard}
      </>
    ),
    lessons: (
      <>
        {lessonCalendar}
        {leaveCard}
      </>
    ),
    credits: creditsCard,
    reports: reportsCard,
    tutor: (
      <>
        {tutorClassesCard}
        {tutorBankCard}
      </>
    ),
    availability: tutorAvailabilityCard,
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
