import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  Card,
  CardHead,
  CardBody,
  Pill,
  PageHeader,
  BackLink,
} from "@/components/admin/ui";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import { requireRole } from "@/lib/auth";
import {
  expandAvailability,
  getAllTutors,
  getEligibleTutors,
  markTakenSlots,
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
  if (!student || coarseRole(student.role) !== "student") notFound();

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

  // Mark slots the tutor is already booked for, so they show as taken rather
  // than being offered (and rejected on submit by the double-booking guard).
  const [sameSubjectMarked, allTutorMarked] = await Promise.all([
    markTakenSlots(sameSubjectSlots),
    markTakenSlots(allTutorSlots),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/users/${studentId}`}>
        Back to {student.firstName} {student.lastName}
      </BackLink>

      <PageHeader
        className="rise"
        eyebrow="Reschedule lesson"
        title={`${student.firstName} ${student.lastName} · ${lesson.subjectName}`}
      />

      {error && (
        <Card accent="bad">
          <CardBody className="text-[13px] text-bad font-medium">
            {error === "invalid-slot"
              ? "Couldn't read that slot - try picking again."
              : error === "slot-taken"
                ? "That slot was just taken - pick another."
                : error === "lesson-past"
                  ? "That lesson has already started, so it can't be rescheduled."
                  : "Something went wrong. Try again."}
          </CardBody>
        </Card>
      )}

      {/* Original lesson context */}
      <section className="rise" style={{ animationDelay: "60ms" }}>
        <Card>
          <CardHead
            title="Original lesson"
            action={<Pill tone="default">{lesson.status}</Pill>}
          />
          <CardBody>
            <div className="grid sm:grid-cols-4 gap-4">
              <Field label="Class">{lesson.className}</Field>
              <Field label="Date">{formatDateLong(lesson.date)}</Field>
              <Field label="Time">
                {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
              </Field>
              <Field label="Tutor">
                {lesson.tutorFirstName} {lesson.tutorLastName}
              </Field>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Slot picker */}
      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Card accent="brand">
          <CardHead title="Pick a new slot" />
          <CardBody>
            <p className="mb-5 text-[13px] text-muted">
              Only this student is moved - other enrolled students still attend
              the original lesson normally.
            </p>
            <SlotPicker
              studentId={studentId}
              lessonId={lessonId}
              originalLessonDate={lesson.date}
              sameSubjectSlots={sameSubjectMarked}
              allTutorSlots={allTutorMarked}
            />
          </CardBody>
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
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted font-bold">
        {label}
      </div>
      <div className="mt-1 text-[14px] font-semibold text-ink">{children}</div>
    </div>
  );
}
