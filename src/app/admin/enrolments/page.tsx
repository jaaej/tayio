import Link from "next/link";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  profiles,
  subjects,
} from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
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
      .where(and(eq(profiles.role, "student"), eq(profiles.isActive, true)))
      .orderBy(profiles.firstName);
    candidates = allStudents.filter((s) => !activeIds.has(s.id));
  }

  return (
    <div className="space-y-10">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Enrolment management
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
          Move students in and out of classes.
        </h1>
      </header>

      {classList.length === 0 ? (
        <Card>
          <CardLabel>No classes</CardLabel>
          <div className="mt-2 text-sm text-ink-soft">
            Create a class first under{" "}
            <Link className="text-brand-600 hover:underline" href="/admin/classes">
              Class management
            </Link>
            .
          </div>
        </Card>
      ) : (
        <section className="grid lg:grid-cols-[280px_1fr] gap-6 rise">
          <Card>
            <CardLabel>Pick a class</CardLabel>
            <div className="mt-4">
              <ClassSelect
                value={selectedId ?? ""}
                options={classList.map((c) => ({
                  id: c.id,
                  label: `${c.name} · ${c.subject}`,
                  meta: `${c.enrolled}/${c.capacity}`,
                }))}
              />
            </div>
          </Card>

          <Card>
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardLabel>{selected.subject}</CardLabel>
                    <h2 className="mt-2 text-2xl text-ink">{selected.name}</h2>
                  </div>
                  <Badge tone="brand">
                    {enrolled.filter((e) => !e.withdrawnAt).length} /{" "}
                    {selected.capacity}
                  </Badge>
                </div>

                <div className="mt-6">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Student</TH>
                        <TH>Email</TH>
                        <TH>Year</TH>
                        <TH>Enrolled</TH>
                        <TH>Status</TH>
                        <TH className="text-right">Actions</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {enrolled.length === 0 && (
                        <TR>
                          <TD colSpan={6} className="text-center text-muted py-6">
                            No students enrolled yet.
                          </TD>
                        </TR>
                      )}
                      {enrolled.map((e) => (
                        <TR key={e.studentId}>
                          <TD className="font-medium">
                            {e.firstName} {e.lastName}
                          </TD>
                          <TD className="text-ink-soft">{e.email}</TD>
                          <TD className="text-ink-soft">
                            {e.yearLevel ? `Yr ${e.yearLevel}` : "—"}
                          </TD>
                          <TD className="text-ink-soft text-xs">
                            {new Date(e.enrolledAt).toLocaleDateString("en-AU")}
                          </TD>
                          <TD>
                            <Badge tone={e.withdrawnAt ? "muted" : "success"}>
                              {e.withdrawnAt ? "withdrawn" : "active"}
                            </Badge>
                          </TD>
                          <TD className="text-right">
                            <EnrolmentActions
                              classId={selected.id}
                              studentId={e.studentId}
                              studentName={`${e.firstName} ${e.lastName}`}
                              withdrawn={!!e.withdrawnAt}
                            />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>

                {enrolled.filter((e) => !e.withdrawnAt).length >=
                  selected.capacity && (
                  <div className="mt-4 text-xs text-amber-700">
                    Class is at capacity — increase capacity in{" "}
                    <Link
                      className="underline"
                      href={`/admin/classes/${selected.id}`}
                    >
                      class settings
                    </Link>{" "}
                    to enrol more.
                  </div>
                )}

                <div className="mt-8">
                  <CardLabel>Add student</CardLabel>
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
                </div>
              </>
            ) : (
              <div className="text-sm text-muted">Select a class.</div>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
