import Link from "next/link";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { STUDENT_TIERS } from "@/lib/roles";
import {
  classes,
  enrollments,
  profiles,
  subjects,
} from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import {
  Card,
  CardHead,
  CardBody,
  Pill,
  PageHeader,
  Empty,
} from "@/components/admin/ui";
import { EnrolmentActions } from "./_components/enrolment-actions";
import { ClassSelect } from "./_components/class-select";

export const dynamic = "force-dynamic";

export default async function EnrolmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const sp = await searchParams;

  const classList = await db
    .select({
      id: classes.id,
      name: classes.name,
      subject: subjects.name,
      capacity: classes.capacity,
      enrolled: sql<number>`(
        select count(*)::int from ${enrollments}
        where ${enrollments.classId} = ${classes.id}
          and ${enrollments.withdrawnAt} is null
      )`,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .orderBy(asc(classes.name));

  const selectedId = sp.class ?? classList[0]?.id ?? null;
  const selected = classList.find((c) => c.id === selectedId) ?? null;

  let enrolled: {
    studentId: string;
    firstName: string;
    lastName: string;
    email: string;
    yearLevel: string | null;
    school: string | null;
    enrolledAt: Date;
    withdrawnAt: Date | null;
  }[] = [];
  let candidates: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }[] = [];

  if (selected) {
    const student = alias(profiles, "student");
    enrolled = await db
      .select({
        studentId: enrollments.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        yearLevel: student.yearLevel,
        school: student.school,
        enrolledAt: enrollments.enrolledAt,
        withdrawnAt: enrollments.withdrawnAt,
      })
      .from(enrollments)
      .innerJoin(student, eq(student.id, enrollments.studentId))
      .where(eq(enrollments.classId, selected.id))
      .orderBy(student.firstName);

    const activeIds = new Set(
      enrolled.filter((e) => !e.withdrawnAt).map((e) => e.studentId),
    );
    const allStudents = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
      })
      .from(profiles)
      .where(and(inArray(profiles.role, STUDENT_TIERS), eq(profiles.isActive, true)))
      .orderBy(profiles.firstName);
    candidates = allStudents.filter((s) => !activeIds.has(s.id));
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        className="rise"
        eyebrow="Enrolment Management"
        title="Move students in and out of classes"
      />

      {classList.length === 0 ? (
        <Card>
          <CardHead title="No classes" />
          <CardBody>
            <div className="text-[13px] text-ink-soft">
              Create a class first under{" "}
              <Link className="text-brand-600 hover:underline" href="/admin/classes">
                Class management
              </Link>
              .
            </div>
          </CardBody>
        </Card>
      ) : (
        <section className="grid lg:grid-cols-[280px_1fr] gap-6 rise">
          <Card>
            <CardHead title="Pick a class" />
            <CardBody>
              <ClassSelect
                value={selectedId ?? ""}
                options={classList.map((c) => ({
                  id: c.id,
                  label: `${c.name} · ${c.subject}`,
                  meta: `${c.enrolled}/${c.capacity}`,
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            {selected ? (
              <>
                <CardHead
                  eyebrow={selected.subject}
                  title={selected.name}
                  action={
                    <Pill tone="brand">
                      {enrolled.filter((e) => !e.withdrawnAt).length} /{" "}
                      {selected.capacity}
                    </Pill>
                  }
                />

                {enrolled.length === 0 ? (
                  <Empty>No students enrolled yet.</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-surface-2 text-[11px] uppercase tracking-[0.08em] text-muted font-bold">
                          <th className="text-left px-5 py-2.5">Student</th>
                          <th className="text-left px-5 py-2.5">Email</th>
                          <th className="text-left px-5 py-2.5">Year</th>
                          <th className="text-left px-5 py-2.5">School</th>
                          <th className="text-left px-5 py-2.5">Enrolled</th>
                          <th className="text-left px-5 py-2.5">Status</th>
                          <th className="text-right px-5 py-2.5">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrolled.map((e) => (
                          <tr
                            key={e.studentId}
                            className="border-b border-line hover:bg-surface-2 transition-colors"
                          >
                            <td className="px-5 py-3 text-[13px] font-bold text-ink">
                              {e.firstName} {e.lastName}
                            </td>
                            <td className="px-5 py-3 text-[13px] text-ink-soft">
                              {e.email}
                            </td>
                            <td className="px-5 py-3 text-[13px] text-ink-soft">
                              {e.yearLevel ? `Yr ${e.yearLevel}` : "-"}
                            </td>
                            <td className="px-5 py-3 text-[13px] text-ink-soft">
                              {e.school || "-"}
                            </td>
                            <td className="px-5 py-3 text-[12px] text-ink-soft tabular-nums">
                              {new Date(e.enrolledAt).toLocaleDateString("en-AU")}
                            </td>
                            <td className="px-5 py-3">
                              <Pill tone={e.withdrawnAt ? "default" : "good"}>
                                {e.withdrawnAt ? "withdrawn" : "active"}
                              </Pill>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <EnrolmentActions
                                classId={selected.id}
                                studentId={e.studentId}
                                studentName={`${e.firstName} ${e.lastName}`}
                                withdrawn={!!e.withdrawnAt}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {enrolled.filter((e) => !e.withdrawnAt).length >=
                  selected.capacity && (
                  <div className="px-5 pt-4 text-[12px] text-warn">
                    Class is at capacity - increase capacity in{" "}
                    <Link
                      className="underline"
                      href={`/admin/classes/${selected.id}`}
                    >
                      class settings
                    </Link>{" "}
                    to enrol more.
                  </div>
                )}

                <CardBody className="border-t border-line">
                  <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
                    Add student
                  </div>
                  <div className="mt-3">
                    <EnrolmentActions
                      classId={selected.id}
                      mode="add"
                      addOptions={candidates.map((c) => ({
                        id: c.id,
                        label: `${c.firstName} ${c.lastName} · ${c.email}`,
                      }))}
                    />
                  </div>
                </CardBody>
              </>
            ) : (
              <CardBody>
                <div className="text-[13px] text-muted">Select a class.</div>
              </CardBody>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
