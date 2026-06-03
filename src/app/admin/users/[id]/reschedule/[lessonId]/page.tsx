import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  expandAvailability,
  getAllTutors,
  getEligibleTutors,
} from "@/lib/availability";
import { formatDateLong, formatTime } from "@/lib/format";
import { getLessonContextForStudent } from "@/app/admin/_lib/queries";
import { SlotPicker } from "./_components/slot-picker";

export const dynamic = "force-dynamic";

export default async function AdminReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("admin");
  const { id: studentId, lessonId } = await params;
  const { error } = await searchParams;

  const [student] = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.id, studentId))
    .limit(1);
  if (!student || student.role !== "student") notFound();

  const lesson = await getLessonContextForStudent(studentId, lessonId);
  if (!lesson) notFound();

  const now = new Date();
  const [sameSubjectTutors, allTutors] = await Promise.all([
    getEligibleTutors(lesson.classId),
    getAllTutors(lesson.tutorId),
  ]);
  const [sameSubjectSlots, allTutorSlots] = await Promise.all([
    expandAvailability(sameSubjectTutors, now, 4),
    expandAvailability(allTutors, now, 4),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <Link
          href={`/admin/users/${studentId}`}
          className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
        >
          ← Back to {student.firstName} {student.lastName}
        </Link>
      </div>

      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Reschedule lesson
        </div>
        <h1 className="mt-2 text-4xl font-medium tracking-tight text-ink">
          {student.firstName} {student.lastName} · {lesson.subjectName}
        </h1>
      </header>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <div className="text-sm text-rose-900">
            {error === "invalid-slot"
              ? "Couldn't read that slot — try picking again."
              : error === "lesson-past"
                ? "That lesson has already started, so it can't be rescheduled."
                : "Something went wrong. Try again."}
          </div>
        </Card>
      )}

      {/* Original lesson context */}
      <section className="rise" style={{ animationDelay: "60ms" }}>
        <Card>
          <CardLabel>Original lesson</CardLabel>
          <div className="mt-3 grid sm:grid-cols-4 gap-4">
            <Field label="Class">{lesson.className}</Field>
            <Field label="Date">{formatDateLong(lesson.date)}</Field>
            <Field label="Time">
              {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
            </Field>
            <Field label="Tutor">
              {lesson.tutorFirstName} {lesson.tutorLastName}
            </Field>
          </div>
          <div className="mt-3">
            <Badge tone="muted">{lesson.status}</Badge>
          </div>
        </Card>
      </section>

      {/* Slot picker */}
      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Card>
          <CardLabel>Pick a new slot</CardLabel>
          <p className="mt-2 mb-5 text-sm text-ink-soft">
            Only this student is moved — other enrolled students still attend
            the original lesson normally.
          </p>
          <SlotPicker
            studentId={studentId}
            lessonId={lessonId}
            originalLessonDate={lesson.date}
            sameSubjectSlots={sameSubjectSlots}
            allTutorSlots={allTutorSlots}
          />
        </Card>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-medium">
        {label}
      </div>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </div>
  );
}
