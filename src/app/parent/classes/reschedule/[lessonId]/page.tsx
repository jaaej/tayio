import { notFound } from "next/navigation";
import {
  Card,
  CardHead,
  CardBody,
  PageHeader,
  BackLink,
} from "@/components/parent/ui";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import {
  getOneOnOneSlots,
  getReschedulableLesson,
  reschedulePath,
  studentOwnsLesson,
} from "@/lib/reschedule";
import { RescheduleForm } from "@/components/reschedule/reschedule-form";
import { getAdminContact, resolveSelectedChild } from "../../../_data";

export const dynamic = "force-dynamic";

export default async function ParentReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ childId?: string }>;
}) {
  const user = await requireRole("parent");
  const { lessonId } = await params;
  const { childId: requestedChild } = await searchParams;

  // Resolve the child being rescheduled and confirm the parent is linked to it.
  const { children, selected } = await resolveSelectedChild(user.id, requestedChild);
  if (!selected) notFound();
  if (requestedChild && !children.some((c) => c.id === requestedChild)) notFound();
  const childId = selected.id;

  const lesson = await getReschedulableLesson(lessonId);
  if (!lesson || !(await studentOwnsLesson(childId, lessonId))) notFound();

  const backHref = `/parent/classes?child=${childId}`;

  const now = new Date();
  const started = new Date(`${lesson.date}T${lesson.startTime}`).getTime() <= now.getTime();

  // Unified model: every reschedule picks an open slot in the tutor's
  // availability (the lesson becomes a make-up at that time).
  const approvalRequired = reschedulePath(lesson, now) === "approval";
  const slots = await getOneOnOneSlots(lesson, now);
  const admin = await getAdminContact();

  return (
    <div className="space-y-6 max-w-[820px]">
      <BackLink href={backHref}>Back to {selected.firstName}'s classes</BackLink>

      <PageHeader
        className="rise"
        eyebrow="Reschedule lesson"
        title={`${selected.firstName} · ${lesson.subjectName}`}
        sub={
          approvalRequired
            ? "We'll send this to the tutor for approval."
            : "Pick an open slot with the tutor to move to."
        }
      />

      <section className="rise" style={{ animationDelay: "60ms" }}>
        <Card>
          <CardHead title="Original lesson" />
          <CardBody>
            <div className="grid sm:grid-cols-4 gap-4">
              <Field label="Class">{lesson.className}</Field>
              <Field label="Date">{formatDateLong(lesson.date)}</Field>
              <Field label="Time">
                {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
              </Field>
              <Field label="Tutor">{lesson.tutorName}</Field>
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Card accent="brand">
          <CardHead title="Pick a new time" />
          <CardBody>
            {started ? (
              <div className="text-[14px] text-muted">
                This lesson has already started, so it can no longer be
                rescheduled.
              </div>
            ) : (
              <RescheduleForm
                lessonId={lesson.id}
                studentId={childId}
                mode="makeup"
                approvalRequired={approvalRequired}
                slots={slots}
                backHref={backHref}
                adminId={admin?.id ?? null}
              />
            )}
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
