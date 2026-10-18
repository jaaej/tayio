import type { ReactNode } from "react";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { enrollments, familyLinks, profiles, type UserRole } from "@/db/schema";
import {
  STUDENT_TIERS,
  canAdminManageAccount,
  coarseRole,
  isUnrestrictedAdmin,
  roleLabel,
} from "@/lib/roles";
import { getCurrentUser } from "@/lib/auth";
import { classDisplayName } from "@/lib/class-display";
import { formatDateLong } from "@/lib/format";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import {
  accountScheduleStatusLabel,
  freeTrialDirectoryState,
} from "@/lib/account-schedule-status";
import {
  Empty,
  MetricTile,
  Pill,
  buttonVariants,
  initialsOf,
} from "@/components/admin/ui";
import {
  getReportTerms,
  getStudentLeave,
  getStudentLessonsInRange,
  getStudentTrial,
  getTutorAvailabilityForTutor,
  getTutorRecord,
  getUserSchedulePeriod,
} from "@/app/admin/_lib/queries";
import {
  getStudentActivity,
  getStudentAllowanceSummary,
  getStudentEnrolledSubjects,
} from "@/lib/admin-credits";
import { TutorBankForm } from "@/app/admin/tutors/_components/tutor-bank-form";
import { TutorAvailabilityEditor } from "@/app/admin/tutors/availability/_components/availability-editor";
import { parseTabParam, tabsForRole, type UserTab } from "@/lib/user-detail-tabs";
import {
  monthBounds,
  parseMonthParam,
} from "@/app/student/_components/month-calendar";
import { getClassMoveData } from "@/lib/class-moves";
import { getStudentCurriculumAccessOverview } from "@/app/admin/_lib/curriculum-access";
import { cn } from "@/lib/utils";
import { UserAdminNoteEditor } from "../_components/user-admin-note-editor";
import { UserAccountActions } from "../_components/user-account-actions";
import { ROLE_AVATAR } from "../_components/role-style";
import { normaliseYearLevel } from "../_lib/directory-list";
import { ListLink, ProfileTabLinks } from "../_components/list-link";
import { getProfileFacts } from "../_lib/profile-facts";
import { getStudentHistory } from "../_lib/student-history";
import {
  AttendanceHistoryList,
  HomeworkHistoryList,
  StaffNotesTimeline,
} from "@/components/student-history/history-lists";
import { EditUserForm } from "./_components/edit-user-form";
import { FamilyLinksManager } from "./_components/family-links-manager";
import { CreditManagement } from "./_components/credit-management";
import { StudentLeaveManager } from "./_components/student-leave-manager";
import { StudentReportControls } from "./_components/student-report-controls";
import { StudentTrialManager } from "./_components/student-trial-manager";
import { AdminLessonCalendar } from "./_components/lesson-calendar";
import { ClassMoveManager } from "./_components/class-move-manager";
import { CurriculumAccessManager } from "./_components/curriculum-access-manager";
import { ProfileSection } from "./_components/profile-section";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_STYLE = {
  active: { label: "Active", text: "text-good", dot: "bg-good" },
  discontinued: { label: "Discontinued", text: "text-muted", dot: "bg-muted" },
  deactivated: { label: "Deactivated", text: "text-bad", dot: "bg-bad" },
} as const;

/**
 * The right pane of the users split view (the list comes from the layout):
 * the person's header, quick facts, and every profile section as a tab.
 */
export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : undefined;
  const month = typeof sp.month === "string" ? sp.month : undefined;

  const [[user], me] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, id)),
    getCurrentUser(),
  ]);
  if (!user) notFound();

  // Parsed against the role, so a stale cross-role link falls back to Profile
  // instead of rendering an empty panel.
  const activeTab = parseTabParam(tab, user.role);
  const role = coarseRole(user.role);
  const isStudent = role === "student";
  const isTutor = role === "tutor";

  const myRole = me?.app_metadata?.role as UserRole | undefined;
  const canManageRoles = isUnrestrictedAdmin(myRole);
  const canEditProfile = canAdminManageAccount(myRole, user.role);

  const basePath = `/admin/users/${id}`;

  const today = melbourneDate(new Date());
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
    classMoveData,
    curriculumAccess,
  ] = isStudent
    ? await Promise.all([
        activeTab === "credits" ? getStudentActivity(id) : Promise.resolve(null),
        activeTab === "credits"
          ? getStudentAllowanceSummary(id)
          : Promise.resolve(null),
        activeTab === "credits"
          ? getStudentEnrolledSubjects(id)
          : Promise.resolve(null),
        activeTab === "lessons" ? getStudentLeave(id) : Promise.resolve(null),
        activeTab === "reports" ? getReportTerms() : Promise.resolve([]),
        getStudentTrial(id),
        activeTab === "lessons"
          ? getStudentLessonsInRange(id, fromIso, toIso)
          : Promise.resolve([]),
        activeTab === "lessons" ? getClassMoveData(id) : Promise.resolve(null),
        activeTab === "curriculum"
          ? getStudentCurriculumAccessOverview(id)
          : Promise.resolve([]),
      ])
    : [null, null, null, null, [], null, [], null, []];

  const history =
    isStudent && activeTab === "history" ? await getStudentHistory(id) : null;

  // canManageRoles is isUnrestrictedAdmin: it decides whether the bank row is
  // fetched at all, so a reception admin never receives payroll PII.
  const [tutorRecord, tutorAvailability] = isTutor
    ? await Promise.all([
        getTutorRecord(id, canManageRoles),
        getTutorAvailabilityForTutor(id),
      ])
    : [null, null];

  const [schedulePeriod, facts, enrolmentTotals, allStudents, allParents] =
    await Promise.all([
      isStudent || isTutor
        ? getUserSchedulePeriod(id, user.role)
        : Promise.resolve(null),
      getProfileFacts(id, user.role, user.email),
      isStudent
        ? db
            .select({
              active: sql<number>`count(*) filter (where ${isNull(enrollments.withdrawnAt)})::int`,
              withdrawn: sql<number>`count(*) filter (where ${enrollments.withdrawnAt} is not null)::int`,
            })
            .from(enrollments)
            .where(eq(enrollments.studentId, id))
        : Promise.resolve([]),
      user.role === "parent"
        ? db
            .select({
              id: profiles.id,
              firstName: profiles.firstName,
              lastName: profiles.lastName,
              email: profiles.email,
            })
            .from(profiles)
            .where(inArray(profiles.role, STUDENT_TIERS))
        : Promise.resolve([]),
      isStudent
        ? db
            .select({
              id: profiles.id,
              firstName: profiles.firstName,
              lastName: profiles.lastName,
              email: profiles.email,
            })
            .from(profiles)
            .where(eq(profiles.role, "parent"))
        : Promise.resolve([]),
    ]);
  const trialState = freeTrialDirectoryState(trial, today);

  type LinkedPerson = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isPrimaryContact: boolean;
  };
  let family: LinkedPerson[] = [];
  if (isStudent) {
    const linkedParent = alias(profiles, "linked_parent");
    family = await db
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
  } else if (user.role === "parent") {
    const linkedStudent = alias(profiles, "linked_student");
    family = await db
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

  const name = `${user.firstName} ${user.lastName}`.trim();
  const totals = enrolmentTotals[0];
  const status: keyof typeof STATUS_STYLE = !user.isActive
    ? "deactivated"
    : totals && totals.withdrawn > 0 && totals.active === 0
      ? "discontinued"
      : "active";
  const statusStyle = STATUS_STYLE[status];
  const scheduleLabel = schedulePeriod
    ? accountScheduleStatusLabel(schedulePeriod, today)
    : null;

  const subParts = [
    isStudent && user.yearLevel ? normaliseYearLevel(user.yearLevel).label : null,
    isStudent ? user.school : null,
    user.email,
    user.phone,
  ].filter((part): part is string => !!part);

  // ---- Sections -----------------------------------------------------------

  const noteSection = (
    <ProfileSection title="Internal note" note="admins only">
      <UserAdminNoteEditor
        userId={user.id}
        initialNote={user.adminNotes}
        canEdit={canEditProfile}
      />
    </ProfileSection>
  );

  const familySection = (isStudent || user.role === "parent") && (
    <ProfileSection title={isStudent ? "Parents" : "Children"}>
      <FamilyLinksManager
        viewer={isStudent ? "student" : "parent"}
        userId={user.id}
        existing={family.map((p) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          email: p.email,
          isPrimaryContact: p.isPrimaryContact,
        }))}
        options={(isStudent ? allParents : allStudents).map((p) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          email: p.email,
        }))}
      />
    </ProfileSection>
  );

  const profileSection = (
    <ProfileSection title="Profile">
      <EditUserForm
        id={user.id}
        firstName={user.firstName}
        lastName={user.lastName}
        email={user.email}
        phone={user.phone ?? ""}
        addressLine1={user.addressLine1 ?? ""}
        addressLine2={user.addressLine2 ?? ""}
        suburb={user.suburb ?? ""}
        state={user.state ?? ""}
        postcode={user.postcode ?? ""}
        yearLevel={user.yearLevel ?? ""}
        school={user.school ?? ""}
        role={user.role}
        canManageRoles={canManageRoles}
        canEditProfile={canEditProfile}
      />
    </ProfileSection>
  );

  const trialSection = isStudent && (
    <ProfileSection title="Free trial" note="tutors see a trial pill">
      <StudentTrialManager studentId={user.id} trial={trial ?? null} />
    </ProfileSection>
  );

  const classMoveSection = isStudent && classMoveData && (
    <ClassMoveManager studentId={user.id} studentName={name} data={classMoveData} />
  );

  const calendarSection = isStudent && (
    <section className="px-4 py-5 sm:px-5">
      <AdminLessonCalendar
        studentId={id}
        year={calendarYear}
        month={calendarMonth}
        lessons={calendarLessons}
        leavePeriods={leavePeriods ?? []}
        basePath={basePath}
      />
    </section>
  );

  const leaveSection = isStudent && (
    <ProfileSection title="Leave / holidays" note="away from all classes">
      <StudentLeaveManager studentId={user.id} periods={leavePeriods ?? []} />
    </ProfileSection>
  );

  const creditsSection = isStudent &&
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

  const curriculumSection = isStudent && (
    <ProfileSection
      title="Curriculum access"
      note="earlier terms need an admin grant"
    >
      <CurriculumAccessManager
        studentId={user.id}
        subjects={curriculumAccess ?? []}
      />
    </ProfileSection>
  );

  const reportsSection = isStudent && (
    <ProfileSection title="Term reports" note="PDF + notify family">
      <StudentReportControls
        studentId={user.id}
        terms={(reportTerms ?? []).map((t) => ({ id: t.id, label: t.label }))}
      />
    </ProfileSection>
  );

  const tutorClassesSection = tutorRecord && (
    <ProfileSection title="Classes" flush>
      {tutorRecord.classes.length === 0 ? (
        <Empty>Not assigned to any classes yet.</Empty>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {tutorRecord.classes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/classes/${c.id}`}
                className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
              >
                <span className="min-w-0 truncate text-[14px] font-bold text-ink">
                  {classDisplayName(c.subjectName, c.name)}
                </span>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-soft">
                  {c.studentCount} {c.studentCount === 1 ? "student" : "students"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ProfileSection>
  );

  // Owner-only: tutor_bank_details is payroll PII. Reception gets nothing here
  // rather than a locked placeholder - gate, don't dangle.
  const tutorBankSection = tutorRecord && canManageRoles && (
    <ProfileSection title="Payroll details">
      <TutorBankForm tutorId={id} initial={tutorRecord.bank} />
    </ProfileSection>
  );

  const availabilitySection = tutorAvailability && (
    <ProfileSection title="Weekly availability">
      <TutorAvailabilityEditor
        tutorId={id}
        subjects={tutorAvailability.subjects}
        slots={tutorAvailability.slots}
      />
    </ProfileSection>
  );

  const historySections = isStudent && history && [
    <ProfileSection
      key="attendance"
      id="attendance"
      title="Attendance"
      note={
        history.summary.percent === null
          ? undefined
          : `${history.summary.percent}% · ${history.summary.attended} of ${history.summary.total} attended`
      }
      flush
    >
      <AttendanceHistoryList
        rows={history.attendance}
        lessonHref={(lessonId) => `/admin/attendance/${lessonId}`}
      />
    </ProfileSection>,
    <ProfileSection key="homework" id="homework" title="Homework" flush>
      <HomeworkHistoryList rows={history.homework} />
    </ProfileSection>,
    <ProfileSection key="notes" id="staff-notes" title="Staff notes" flush>
      <StaffNotesTimeline accountNote={history.accountNote} notes={history.notes} />
    </ProfileSection>,
  ];

  const panels: Record<UserTab, ReactNode[]> = {
    profile: [noteSection, familySection, profileSection, trialSection],
    lessons: [classMoveSection, calendarSection, leaveSection],
    history: historySections || [],
    credits: [creditsSection],
    curriculum: [curriculumSection],
    reports: [reportsSection],
    tutor: [tutorClassesSection, tutorBankSection],
    availability: [availabilitySection],
  };

  const tabs = tabsForRole(user.role);

  return (
    <section
      aria-labelledby="user-profile-name"
      className="glass flex min-w-0 flex-col gap-1.5 rounded-[24px] p-1.5"
    >
      <div className="flex flex-wrap items-center gap-3.5 px-2.5 pb-2 pt-2.5 sm:pl-3.5">
        <ListLink
          href="/admin/users"
          aria-label="All users"
          title="All users"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/95 bg-white/65 text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 xl:hidden"
        >
          <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
        </ListLink>
        <span
          aria-hidden
          className={cn(
            "grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full text-[18px] font-extrabold",
            ROLE_AVATAR[role],
          )}
        >
          {initialsOf(name)}
        </span>
        <div className="flex min-w-0 flex-1 basis-[240px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="user-profile-name"
              className="text-[20px] font-extrabold leading-tight text-ink"
            >
              {name}
            </h2>
            <span className="inline-flex h-[22px] items-center rounded-full bg-white px-[9px] text-[11px] font-extrabold text-ink">
              {roleLabel(user.role)}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-[5px] text-[12px] font-extrabold",
                statusStyle.text,
              )}
            >
              <span aria-hidden className={cn("h-[7px] w-[7px] rounded-full", statusStyle.dot)} />
              {statusStyle.label}
            </span>
            {scheduleLabel && schedulePeriod && (
              <span
                title={`${formatDateLong(schedulePeriod.startDate)} - ${formatDateLong(schedulePeriod.endDate)}`}
              >
                <Pill tone={schedulePeriod.approval === "pending" ? "warn" : "info"}>
                  {scheduleLabel}
                </Pill>
              </span>
            )}
            {trialState && trialState !== "ended" && trial && (
              <span
                title={`Free trial: ${formatDateLong(trial.startDate)} - ${formatDateLong(trial.endDate)}`}
              >
                <Pill tone={trialState === "current" ? "good" : "brand"}>
                  {trialState === "current" ? "Free trial" : "Trial scheduled"}
                </Pill>
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold text-ink-soft [overflow-wrap:anywhere]">
            {subParts.join(" · ")}
            {family.length > 0 && (
              <>
                {" · "}
                {isStudent ? (family.length === 1 ? "Parent" : "Parents") : "Children"}:{" "}
                {family.map((person, index) => (
                  <Fragment key={person.id}>
                    {index > 0 && ", "}
                    <ListLink
                      href={`/admin/users/${person.id}`}
                      className="font-bold text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      {`${person.firstName} ${person.lastName}`.trim()}
                    </ListLink>
                  </Fragment>
                ))}
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={`/admin/messages/with/${user.id}`}
            className={cn(
              buttonVariants({ variant: "glass", size: "md" }),
              "h-[38px] rounded-[11px]",
            )}
          >
            Message
          </Link>
          {canEditProfile && (
            <UserAccountActions
              id={user.id}
              email={user.email}
              isActive={user.isActive}
              name={name}
              canManageAccount={canEditProfile}
              canHardDelete={canManageRoles}
            />
          )}
        </div>
      </div>

      {facts.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {facts.map((fact) => (
            <MetricTile
              key={fact.label}
              label={fact.label}
              value={fact.value}
              sub={fact.sub}
              tone={fact.tone}
              href={fact.href}
            />
          ))}
        </div>
      )}

      <div className="panel min-w-0 overflow-hidden">
        {tabs.length > 1 && (
          <ProfileTabLinks
            basePath={basePath}
            tabs={tabs.map((t) => ({
              key: t.key,
              label: t.label,
              active: t.key === activeTab,
            }))}
          />
        )}
        <div className="divide-y divide-line">
          {panels[activeTab].map((section, index) => (
            <Fragment key={index}>{section || null}</Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
