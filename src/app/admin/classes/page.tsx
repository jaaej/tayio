import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, profiles, subjects } from "@/db/schema";
import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { CreateClassForm } from "./_components/create-class-form";
import { CreateSubjectForm } from "./_components/create-subject-form";
import { DeleteClassButton } from "./_components/delete-class-button";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ClassesPage() {
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      capacity: classes.capacity,
      location: classes.location,
      onlineLink: classes.onlineLink,
      weekday: classes.weekday,
      startTime: classes.startTime,
      endTime: classes.endTime,
      isRecurring: classes.isRecurring,
      subject: subjects.name,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
      enrolled: sql<number>`(
        select count(*)::int from ${enrollments}
        where ${enrollments.classId} = ${classes.id}
          and ${enrollments.withdrawnAt} is null
      )`,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .orderBy(classes.name);

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

  return (
    <div className="space-y-10">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Class management
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Set up the{" "}
          <span className="">weekly cadence</span>.
        </h1>
      </header>

      <section className="grid lg:grid-cols-2 gap-5 rise">
        <Card>
          <CardLabel>Create class</CardLabel>
          <div className="mt-4">
            <CreateClassForm tutors={tutors} subjects={subjectList} />
          </div>
        </Card>
        <Card>
          <CardLabel>Subjects</CardLabel>
          <ul className="mt-3 divide-y divide-hairline/60">
            {subjectList.length === 0 && (
              <li className="py-2 text-sm text-muted">No subjects yet.</li>
            )}
            {subjectList.map((s) => (
              <li
                key={s.id}
                className="py-2 text-sm text-ink-soft flex items-center justify-between"
              >
                <span>{s.name}</span>
                {s.yearLevel && (
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
                    Yr {s.yearLevel}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <CreateSubjectForm />
          </div>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Table>
          <THead>
            <TR>
              <TH>Class</TH>
              <TH>Subject</TH>
              <TH>Tutor</TH>
              <TH>Schedule</TH>
              <TH>Capacity</TH>
              <TH>Location</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <TR>
                <TD colSpan={7} className="text-center text-muted py-8">
                  No classes yet — create your first above.
                </TD>
              </TR>
            )}
            {rows.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">
                  <Link
                    href={`/admin/classes/${c.id}`}
                    className="hover:text-brand-700"
                  >
                    {c.name}
                  </Link>
                </TD>
                <TD className="text-ink-soft">{c.subject}</TD>
                <TD className="text-ink-soft">
                  {c.tutorFirst} {c.tutorLast}
                </TD>
                <TD className="text-ink-soft">
                  {c.isRecurring && c.weekday !== null
                    ? `${WEEKDAYS[c.weekday]} · ${c.startTime ?? ""}–${c.endTime ?? ""}`
                    : "One-off"}
                </TD>
                <TD>
                  <Badge tone={c.enrolled >= c.capacity ? "warn" : "neutral"}>
                    {c.enrolled} / {c.capacity}
                  </Badge>
                </TD>
                <TD className="text-ink-soft text-xs">
                  {c.location || (c.onlineLink ? "Online" : "—")}
                </TD>
                <TD className="text-right">
                  <div className="inline-flex items-center gap-3">
                    <Link
                      href={`/admin/classes/${c.id}`}
                      className="text-xs uppercase tracking-[0.14em] text-brand-700 hover:text-brand-600"
                    >
                      Edit
                    </Link>
                    <DeleteClassButton id={c.id} name={c.name} />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
