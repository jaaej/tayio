import Link from "next/link";
import { ClipboardCheck, UserX, CalendarDays } from "lucide-react";
import { Card, StatTile, PageHeader, Empty } from "@/components/parent/ui";
import { StatusBadge } from "@/components/data/status-badge";
import { CreditPanel } from "@/components/reschedule/credit-panel";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import { listRedeemableCredits } from "@/lib/credits";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_STYLE,
} from "@/lib/status";
import {
  getAdminContact,
  getAttendance,
  getClassIdForLesson,
  getMonthLessons,
  getRescheduleLessonForParent,
  getUpcomingLessonsForChild,
  resolveSelectedChild,
} from "../_data";
import { getAvailableSlots } from "../_lib/availability";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import {
  MonthCalendar,
  monthBounds,
  parseMonthParam,
} from "../_components/month-calendar";
import { SectionHeader } from "../_components/section-header";
import { BtnLink } from "../_components/button-link";
import { submitRescheduleRequest } from "../_actions";

type SearchParams = Promise<{
  child?: string;
  month?: string;
  reschedule?: string;
  submitted?: string;
  error?: string;
}>;

export default async function ParentClassesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const params = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, params.child);

  if (!selected) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Classes"
          sub="Your children's lessons and reschedule requests."
        />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const { year, month } = parseMonthParam(params.month);
  const monthIso = `${year}-${String(month + 1).padStart(2, "0")}`;
  const { fromIso, toIso } = monthBounds(year, month);

  const [monthLessons, attendanceRows, upcomingLessons, credits, admin] =
    await Promise.all([
      getMonthLessons(selected.id, fromIso, toIso),
      getAttendance(selected.id),
      getUpcomingLessonsForChild(selected.id, 12),
      listRedeemableCredits(selected.id),
      getAdminContact(),
    ]);

  const total = attendanceRows.length;
  const present = attendanceRows.filter(
    (r) =>
      r.status === "present" ||
      r.status === "late" ||
      r.status === "makeup_attended",
  ).length;
  const absent = attendanceRows.filter((r) => r.status === "absent").length;
  const rate = total > 0 ? Math.round((present / total) * 100) : null;

  const isPickLesson = params.reschedule === "pick";
  const rescheduleLesson =
    params.reschedule && !isPickLesson
      ? await getRescheduleLessonForParent(user.id, params.reschedule)
      : null;
  const mode: "view" | "pick-lesson" | "pick-slot" = rescheduleLesson
    ? "pick-slot"
    : isPickLesson
      ? "pick-lesson"
      : "view";

  const rescheduleClassId = rescheduleLesson
    ? await getClassIdForLesson(rescheduleLesson.id)
    : null;
  const availableSlots =
    rescheduleClassId !== null
      ? await getAvailableSlots(rescheduleClassId, new Date(), 8)
      : [];

  const cancelHref = `/parent/classes?child=${selected.id}&month=${monthIso}`;
  const pickLessonHref = `${cancelHref}&reschedule=pick`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${selected.firstName}'s classes`}
        sub="Calendar, attendance log and reschedule requests."
        actions={
          mode === "view" && upcomingLessons.length > 0 ? (
            <BtnLink href={pickLessonHref} variant="brand">
              Reschedule a class
            </BtnLink>
          ) : undefined
        }
      />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            children={children}
            selectedId={selected.id}
            basePath="/parent/classes"
          />
        </div>
      )}

      {params.submitted === "1" && (
        <Card accent="good" className="rise">
          <div className="p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-good">
              Request submitted
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              Your reschedule request has been sent to the admin team. They'll
              confirm by email.
            </p>
          </div>
        </Card>
      )}

      {params.error === "1" && (
        <Card accent="bad" className="rise">
          <div className="p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-bad">
              Couldn't submit request
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              Please pick a slot and try again.
            </p>
          </div>
        </Card>
      )}

      <section
        className="grid grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Attendance rate"
          value={rate !== null ? `${rate}%` : "-"}
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="mint"
          accent
          delta="All logged lessons"
          deltaTone={
            rate === null ? "flat" : rate >= 90 ? "up" : rate < 75 ? "down" : "flat"
          }
        />
        <StatTile
          label="Absences"
          value={absent.toString()}
          icon={<UserX className="h-5 w-5" />}
          tone={absent === 0 ? "good" : "coral"}
          accent
          delta="Marked absent"
          deltaTone={absent === 0 ? "up" : "down"}
        />
        <StatTile
          label="Lessons logged"
          value={total.toString()}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="sky"
          accent
          delta="This term"
        />
      </section>

      {mode === "pick-slot" && rescheduleLesson ? (
        <form
          action={submitRescheduleRequest}
          className="space-y-3 rise"
          style={{ animationDelay: "60ms" }}
        >
          <input type="hidden" name="lessonId" value={rescheduleLesson.id} />
          <input type="hidden" name="childId" value={selected.id} />
          <input type="hidden" name="month" value={monthIso} />

          <Card>
            <div className="px-6 py-5 border-b border-line bg-brand-50">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-brand-700">
                    Pick a new time
                  </div>
                  <div className="mt-1 text-base text-ink">
                    Moving <span className="font-medium">{rescheduleLesson.subjectName}</span>{" "}
                    on {formatDateLong(rescheduleLesson.date)} at{" "}
                    {formatTime(rescheduleLesson.startTime)}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    Click a green slot in the calendar to submit.
                  </div>
                </div>
                <Link
                  href={pickLessonHref}
                  className="shrink-0 text-sm text-brand-700 hover:underline"
                >
                  Pick a different class
                </Link>
              </div>
              <div className="mt-4">
                <label
                  htmlFor="reason"
                  className="block text-[11px] uppercase tracking-[0.14em] text-muted"
                >
                  Reason (optional)
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  rows={2}
                  placeholder="Anything the admin team should know?"
                  className="mt-1 block w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div className="mt-3">
                <Link
                  href={cancelHref}
                  className="text-xs text-ink-soft hover:text-ink"
                >
                  ← Cancel reschedule
                </Link>
              </div>
            </div>
            {availableSlots.length === 0 && (
              <div className="px-6 py-4 bg-amber-50 border-b border-amber-200/70 text-sm text-amber-900">
                No classes available - no tutor teaching{" "}
                {rescheduleLesson.subjectName} has open slots in the next 8
                weeks. Pick a different class or contact the office.
              </div>
            )}
            <div className="p-5 bg-gradient-to-b from-brand-50/30 to-transparent">
              <MonthCalendar
                year={year}
                month={month}
                lessons={monthLessons}
                basePath="/parent/classes"
                childId={selected.id}
                mode="pick-slot"
                availableSlots={availableSlots}
                selectedLessonId={rescheduleLesson.id}
              />
            </div>
          </Card>
        </form>
      ) : (
        <div className="rise" style={{ animationDelay: "60ms" }}>
        <Card>
          <SectionHeader
            title={`${selected.firstName}'s schedule`}
            description={
              mode === "pick-lesson"
                ? "Click a lesson to move it. Then pick a new time on the next screen."
                : "Click a lesson to request a reschedule."
            }
          />
          {mode === "pick-lesson" && (
            <div className="px-6 py-3 bg-brand-50 border-b border-line flex items-baseline justify-between gap-3">
              <div className="text-sm text-ink">
                <span className="font-medium">Pick the class to move.</span>
                <span className="text-muted ml-2">
                  Tap any lesson on the calendar below.
                </span>
              </div>
              <Link
                href={cancelHref}
                className="shrink-0 text-xs text-ink-soft hover:text-ink"
              >
                Cancel
              </Link>
            </div>
          )}
          {mode === "view" && upcomingLessons.length > 0 && (
            <div className="px-5 pt-5">
              <Link
                href={pickLessonHref}
                className="group flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 text-brand-700 px-6 py-3 hover:from-brand-200 hover:via-brand-300 hover:to-brand-200 transition-colors"
              >
                <span className="text-base font-bold">Reschedule a class</span>
                <span
                  aria-hidden
                  className="text-xl shrink-0 transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>
          )}
          <div className="p-5 bg-gradient-to-b from-brand-50/30 to-transparent">
            <MonthCalendar
              year={year}
              month={month}
              lessons={monthLessons}
              basePath="/parent/classes"
              childId={selected.id}
              mode={mode === "pick-lesson" ? "pick-lesson" : "view"}
            />
          </div>
        </Card>
        </div>
      )}

      {credits.length > 0 && (
        <div className="rise" style={{ animationDelay: "70ms" }}>
          <CreditPanel
            credits={credits}
            studentId={selected.id}
            adminId={admin?.id ?? null}
          />
        </div>
      )}

      <div className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <SectionHeader
            title="Lesson Log"
            link={{ href: "/parent/feedback", label: "Tutor feedback" }}
          />
          {attendanceRows.length === 0 ? (
            <Empty>
              No attendance has been recorded yet for {selected.firstName}.
            </Empty>
          ) : (
            <div className="divide-y divide-line/70">
              {attendanceRows.map((r) => (
                <div
                  key={r.lessonId}
                  className="grid grid-cols-12 items-center gap-4 px-6 py-4"
                >
                  <div className="col-span-4 min-w-0">
                    <div className="text-base text-ink">
                      {formatDateLong(r.date)}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {formatTime(r.startTime)}
                    </div>
                  </div>
                  <div className="col-span-3 text-sm text-ink-soft min-w-0 truncate">
                    {r.subjectName ?? "-"}
                  </div>
                  <div className="col-span-2 text-sm text-ink-soft min-w-0 truncate">
                    {r.tutorName}
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-3">
                    {r.note && (
                      <span className="text-xs text-muted truncate max-w-[10rem]">
                        {r.note}
                      </span>
                    )}
                    <StatusBadge
                      label={ATTENDANCE_STATUS_LABEL[r.status] ?? r.status}
                      className={ATTENDANCE_STATUS_STYLE[r.status]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
