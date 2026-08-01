import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, profiles, subjects } from "@/db/schema";
import { STUDENT_TIERS } from "@/lib/roles";
import {
  Card,
  CardHead,
  CardBody,
  Hero,
  HeroChip,
  BackLink,
  Button,
} from "@/components/admin/ui";
import { formatTime } from "@/lib/format";
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

  const scheduleChip =
    row.isRecurring && row.weekday !== null && row.startTime && row.endTime
      ? `${WEEKDAY_SHORT[row.weekday]} · ${formatTime(row.startTime)}–${formatTime(row.endTime)}`
      : "No recurring slot";

  return (
    <div className="space-y-6 max-w-[1100px]">
      <BackLink href="/admin/classes">All classes</BackLink>

      <Hero
        className="rise"
        eyebrow="Edit class"
        title={row.name}
        icon={row.name.charAt(0).toUpperCase()}
        chips={
          <>
            {subjectName && <HeroChip>{subjectName}</HeroChip>}
            <HeroChip>{scheduleChip}</HeroChip>
            <HeroChip>
              {enrolled.length}/{row.capacity} enrolled
            </HeroChip>
            {row.location && <HeroChip>{row.location}</HeroChip>}
          </>
        }
        right={
          <a href={`/admin/subjects/${row.subjectId}/curriculum`}>
            <Button variant="outline">Open curriculum →</Button>
          </a>
        }
      />

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardHead title="Details" />
          <CardBody>
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
          </CardBody>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Card>
          <CardHead title="Enrolled students" />
          <CardBody>
            <EnrollmentsManager
              classId={id}
              enrolled={enrolled}
              availableStudents={availableStudents}
              capacity={row.capacity}
            />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
