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
  hasPriorReschedule,
  studentOwnsLesson,
} from "@/lib/reschedule";
import {
  getCancellationsUsed,
  getReschedulesUsed,
  getTerms,
  isLessonCancelled,
} from "@/lib/credits";
import {
  CANCEL_CAP,
  RESCHEDULE_CAP,
  meetsCancelNotice,
  meetsRescheduleNotice,
  remaining,
  resolveTerm,
} from "@/lib/reschedule-credits";
import {
  RescheduleForm,
  CancelLessonAction,
} from "@/components/reschedule/reschedule-form";
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
  // availability (the lesson becomes a make-up at that time). Reschedule and
  // cancellation are each gated on a notice window + a per-term cap - mirrors
  // the student unrestricted timetable (src/app/student/timetable/page.tsx).
  const terms = await getTerms();
  const term = resolveTerm(lesson.date, terms);
  const [cancelUsed, rescheduleUsed, alreadyMoved, alreadyCancelled] = term
    ? await Promise.all([
        getCancellationsUsed(childId, term.id),
        getReschedulesUsed(childId, term.id),
        hasPriorReschedule(childId, lesson.id),
        isLessonCancelled(lesson.id, childId),
      ])
    : [0, 0, false, false];
  const cancelRemaining = term ? remaining(CANCEL_CAP, cancelUsed) : null;
  const rescheduleRemaining = term ? remaining(RESCHEDULE_CAP, rescheduleUsed) : null;

  const rescheduleNoticeOk = meetsRescheduleNotice(now, lesson.date, lesson.startTime);
  const cancelNoticeOk = meetsCancelNotice(now, lesson.date, lesson.startTime);

  const canReschedule =
    !started &&
    term !== null &&
    !alreadyCancelled &&
    rescheduleNoticeOk &&
    (rescheduleRemaining ?? 0) > 0;
  // Cancel additionally requires the lesson still be in its normal state - a
  // lesson already moved or cancelled must not also be cancelled again (that
  // would grant a second credit for the same slot).
  const canCancel =
    !started &&
    term !== null &&
    !alreadyMoved &&
    !alreadyCancelled &&
    cancelNoticeOk &&
    (cancelRemaining ?? 0) > 0;

  function rescheduleIneligibleReason(): string {
    if (!term) return "This lesson is outside a known term.";
    if (alreadyCancelled) return "This lesson has already been moved or cancelled.";
    if (!rescheduleNoticeOk) return "Reschedules need at least 7 days notice.";
    return "You have used all 3 reschedules this term.";
  }
  function cancelIneligibleReason(): string {
    if (!term) return "This lesson is outside a known term.";
    if (alreadyMoved || alreadyCancelled)
      return "This lesson has already been moved or cancelled.";
    if (!cancelNoticeOk) return "Cancellations need at least 24 hours notice.";
    return "You have used all 3 cancellations this term.";
  }

  // Only compute the tutor's open slots when the reschedule is actually
  // eligible - otherwise the picker isn't shown at all.
  const slots = canReschedule ? await getOneOnOneSlots(lesson, now) : [];
  const admin = await getAdminContact();

  return (
    <div className="space-y-6 max-w-[820px]">
      <BackLink href={backHref}>Back to {selected.firstName}'s classes</BackLink>

      <PageHeader
        className="rise"
        eyebrow="Reschedule lesson"
        title={`${selected.firstName} · ${lesson.subjectName}`}
        sub="Pick an open slot with the tutor to move to, or cancel for a class credit."
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

      {started ? (
        <section className="rise" style={{ animationDelay: "120ms" }}>
          <Card accent="brand">
            <CardHead title="Pick a new time" />
            <CardBody>
              <div className="text-[14px] text-muted">
                This lesson has already started, so it can no longer be
                rescheduled or cancelled.
              </div>
            </CardBody>
          </Card>
        </section>
      ) : (
        <>
          <section className="rise" style={{ animationDelay: "120ms" }}>
            <Card accent="brand">
              <CardHead title="Pick a new time" />
              <CardBody>
                <RescheduleForm
                  lessonId={lesson.id}
                  studentId={childId}
                  mode="makeup"
                  canReschedule={canReschedule}
                  rescheduleIneligibleReason={rescheduleIneligibleReason()}
                  rescheduleRemaining={rescheduleRemaining}
                  slots={slots}
                  backHref={backHref}
                  adminId={admin?.id ?? null}
                />
              </CardBody>
            </Card>
          </section>

          <section className="rise" style={{ animationDelay: "180ms" }}>
            <Card accent="bad">
              <CardHead title="Cancel this lesson" />
              <CardBody>
                <CancelLessonAction
                  lessonId={lesson.id}
                  studentId={childId}
                  canCancel={canCancel}
                  cancelIneligibleReason={cancelIneligibleReason()}
                  cancelRemaining={cancelRemaining}
                  adminId={admin?.id ?? null}
                />
              </CardBody>
            </Card>
          </section>
        </>
      )}
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
