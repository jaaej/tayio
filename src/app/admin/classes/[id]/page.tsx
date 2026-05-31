import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, profiles, subjects } from "@/db/schema";
import { Card, CardLabel } from "@/components/ui/card";
import { EditClassForm } from "./_components/edit-class-form";
import { EnrollmentsManager } from "./_components/enrollments-manager";

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
        ? and(eq(profiles.role, "student"), notInArray(profiles.id, enrolledIds))
        : eq(profiles.role, "student"),
    )
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));
  const availableStudents = await availableStudentsQuery;

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/classes"
          className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
        >
          ← All classes
        </Link>
      </div>

      <header className="rise flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            Edit class
          </div>
          <h1 className="mt-2 text-4xl font-medium tracking-tight text-ink">
            {row.name}
          </h1>
        </div>
        <Link
          href={`/admin/subjects/${row.subjectId}/curriculum`}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 shrink-0 transition-colors"
        >
          Open curriculum →
        </Link>
      </header>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardLabel>Details</CardLabel>
          <div className="mt-4">
            <EditClassForm
              id={row.id}
              initial={{
                name: row.name,
                subjectId: row.subjectId,
                tutorId: row.tutorId,
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
          </div>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Card>
          <CardLabel>Enrolled students</CardLabel>
          <div className="mt-4">
            <EnrollmentsManager
              classId={id}
              enrolled={enrolled}
              availableStudents={availableStudents}
              capacity={row.capacity}
            />
          </div>
        </Card>
      </section>
    </div>
  );
}
