import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, profiles, subjects } from "@/db/schema";
import { STUDENT_TIERS } from "@/lib/roles";
import Link from "next/link";
import { GlassPanel, PageHeader, buttonVariants } from "@/components/admin/ui";
import { formatTimeRange } from "@/lib/format";
import { classNameDetail } from "@/lib/class-display";
import { subjectTone } from "@/lib/subject-tone";
import { EditClassForm } from "./_components/edit-class-form";
import { EnrollmentsManager } from "./_components/enrollments-manager";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const dynamic = "force-dynamic";

export default async function ClassEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row] = await db.select().from(classes).where(eq(classes.id, id));
  if (!row) notFound();

  const tutors = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(eq(profiles.role, "tutor"))
    .orderBy(profiles.firstName);

  const subjectList = await db
    .select({ id: subjects.id, name: subjects.name, yearLevel: subjects.yearLevel })
    .from(subjects)
    .orderBy(subjects.name);

  const enrolled = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      school: profiles.school,
      deliveryMode: enrollments.deliveryMode,
      adminNotes: enrollments.adminNotes,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .where(
      and(eq(enrollments.classId, id), isNull(enrollments.withdrawnAt)),
    )
    .orderBy(asc(profiles.school), asc(profiles.firstName), asc(profiles.lastName));

  const enrolledIds = enrolled.map((e) => e.id);
  const availableStudentsQuery = db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
    })
    .from(profiles)
    .where(
      enrolledIds.length > 0
        ? and(inArray(profiles.role, STUDENT_TIERS), notInArray(profiles.id, enrolledIds))
        : inArray(profiles.role, STUDENT_TIERS),
    )
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));
  const availableStudents = await availableStudentsQuery;

  const subjectName =
    subjectList.find((s) => s.id === row.subjectId)?.name ?? null;
  const classDetail = classNameDetail(subjectName, row.name);
  const classTitle = classDetail || subjectName || row.name;
  const showSubjectChip = Boolean(subjectName && classDetail);

  const scheduleChip =
    row.isRecurring && row.weekday !== null && row.startTime && row.endTime
      ? `${WEEKDAY_SHORT[row.weekday]} · ${formatTimeRange(row.startTime, row.endTime)}`
      : "No recurring slot";
  const tone = subjectName ? subjectTone(subjectName) : null;
  const chip =
    "inline-flex h-6 items-center whitespace-nowrap rounded-full bg-white/75 px-2.5 text-[12px] font-bold text-ink";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: "/admin/classes", label: "All classes" }}
        title={classTitle}
        sub={
          <span className="mt-1 flex flex-wrap gap-1.5">
            {showSubjectChip && tone && (
              <span
                className={chip}
                style={{ backgroundColor: tone.bg, color: tone.fg }}
              >
                {subjectName}
              </span>
            )}
            <span className={chip}>{scheduleChip}</span>
            <span className={`${chip} tabular-nums`}>
              {enrolled.length}/{row.capacity} enrolled
            </span>
            {row.location && <span className={chip}>{row.location}</span>}
          </span>
        }
        actions={
          <Link
            href={`/admin/subjects/${row.subjectId}/curriculum`}
            className={buttonVariants({ variant: "glass", size: "lg" })}
          >
            Open curriculum
          </Link>
        }
      />

      <div className="flex flex-wrap items-start gap-5">
        <EnrollmentsManager
          className="min-w-0 flex-[999_1_520px]"
          classId={id}
          enrolled={enrolled}
          availableStudents={availableStudents}
          capacity={row.capacity}
        />

        <GlassPanel
          className="min-w-0 flex-[1_1_340px] lg:max-w-[420px]"
          title="Class details"
          titleId="class-details-heading"
        >
          <EditClassForm
            id={row.id}
            initial={{
              name: row.name,
              subjectId: row.subjectId,
              tutorId: row.tutorId,
              classType: row.classType,
              capacity: row.capacity,
              location: row.location ?? "",
              onlineLink: row.onlineLink ?? "",
              isRecurring: row.isRecurring,
              weekday: row.weekday ?? null,
              startTime: row.startTime ?? "",
              endTime: row.endTime ?? "",
            }}
            tutors={tutors}
            subjects={subjectList}
          />
        </GlassPanel>
      </div>
    </div>
  );
}
