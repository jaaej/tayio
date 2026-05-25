import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateLong, formatTime } from "@/lib/format";
import { submitRescheduleRequest } from "../_actions";
import type { RescheduleLessonDetail } from "../_data";

export function ReschedulePanel({
  lesson,
  childId,
  monthIso,
  basePath,
}: {
  lesson: RescheduleLessonDetail;
  childId: string;
  monthIso: string;
  basePath: string;
}) {
  const params = new URLSearchParams();
  if (childId) params.set("child", childId);
  if (monthIso) params.set("month", monthIso);
  const closeHref = `${basePath}?${params.toString()}`;

  const blocked =
    lesson.status === "cancelled" ||
    lesson.status === "completed" ||
    lesson.status === "missed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Link
        href={closeHref}
        aria-label="Close"
        className="fixed inset-0 bg-ink/30 backdrop-blur-sm"
      />
      <Card className="relative w-full max-w-lg p-0 overflow-hidden shadow-[0_24px_60px_-24px_rgba(29,41,81,0.4)]">
        <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
              Request reschedule
            </div>
            <h2 className="mt-1 text-xl font-medium text-ink truncate">
              {lesson.subjectName}
            </h2>
          </div>
          <Link
            href={closeHref}
            className="text-sm text-ink-soft hover:text-ink shrink-0"
          >
            Close
          </Link>
        </div>

        <div className="px-6 py-5 space-y-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Student
              </dt>
              <dd className="mt-0.5 text-ink">{lesson.childFirstName}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Tutor
              </dt>
              <dd className="mt-0.5 text-ink">{lesson.tutorName}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Date
              </dt>
              <dd className="mt-0.5 text-ink">{formatDateLong(lesson.date)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Time
              </dt>
              <dd className="mt-0.5 text-ink">
                {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
              </dd>
            </div>
          </dl>

          {blocked ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200/70 p-4 text-sm text-amber-900">
              This lesson is {lesson.status} and can't be rescheduled. Contact
              the office for a make-up class.
            </div>
          ) : (
            <form action={submitRescheduleRequest} className="space-y-4">
              <input type="hidden" name="lessonId" value={lesson.id} />
              <input type="hidden" name="childId" value={childId} />
              <input type="hidden" name="month" value={monthIso} />

              <div className="space-y-1.5">
                <label
                  htmlFor="reason"
                  className="block text-[11px] uppercase tracking-[0.16em] text-muted"
                >
                  Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  required
                  minLength={5}
                  rows={4}
                  placeholder="Why does this lesson need to be rescheduled?"
                  className="block w-full rounded-lg border border-hairline/70 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="preferredAlternative"
                  className="block text-[11px] uppercase tracking-[0.16em] text-muted"
                >
                  Preferred alternative (optional)
                </label>
                <input
                  id="preferredAlternative"
                  name="preferredAlternative"
                  type="text"
                  placeholder='e.g. "Saturday morning" or "any time next week"'
                  className="block w-full rounded-lg border border-hairline/70 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div className="text-xs text-muted leading-relaxed">
                Your request goes to the admin team — they'll confirm a new
                time by email.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Link
                  href={closeHref}
                  className="px-4 py-2 text-sm text-ink-soft hover:text-ink"
                >
                  Cancel
                </Link>
                <Button type="submit" variant="primary" size="sm">
                  Submit request
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
