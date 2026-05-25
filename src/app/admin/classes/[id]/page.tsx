import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, profiles, subjects } from "@/db/schema";
import { Card, CardLabel } from "@/components/ui/card";
import { EditClassForm } from "./_components/edit-class-form";

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

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/classes"
          className="text-xs uppercase tracking-[0.16em] text-brand-700 hover:text-brand-600"
        >
          ← All classes
        </Link>
      </div>

      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Edit class
        </div>
        <h1 className="mt-2 text-4xl font-medium tracking-tight text-ink">
          {row.name}
        </h1>
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
    </div>
  );
}
