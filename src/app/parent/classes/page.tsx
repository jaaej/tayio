import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/status-badge";
import { StatTile } from "@/components/data/stat-tile";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_STYLE,
} from "@/lib/status";
import {
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
        <Header />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const { year, month } = parseMonthParam(params.month);
  const monthIso = `${year}-${String(month + 1).padStart(2, "0")}`;
  const { fromIso, toIso } = monthBounds(year, month);

  const [monthLessons, attendanceRows, upcomingLessons] = await Promise.all([
    getMonthLessons(selected.id, fromIso, toIso),
    getAttendance(selected.id),
    getUpcomingLessonsForChild(selected.id, 12),
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
      <Header subtitle={selected.firstName} />

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
        <Card className="rise border-emerald-200/70 bg-emerald-50">
          <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-800">
            Request submitted
          </div>
          <p className="mt-1 text-sm text-emerald-900">
            Your reschedule request has been sent to the admin team. They'll
            confirm by email.
          </p>
        </Card>
      )}

      {params.error === "1" && (
        <Card className="rise border-rose-200/70 bg-rose-50">
          <div className="text-[11px] uppercase tracking-[0.16em] text-rose-800">
            Couldn't submit request
          </div>
          <p className="mt-1 text-sm text-rose-900">
            Please pick a slot and try again.
          </p>
        </Card>
      )}

      <section
        className="grid grid-cols-2 lg:grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Attendance rate"
          value={rate !== null ? `${rate}%` : "—"}
          accent={
            rate === null
              ? "muted"
              : rate >= 90
                ? "success"
                : rate >= 75
                  ? "brand"
                  : "warn"
          }
        />
        <StatTile
          label="Absences"
          value={absent.toString()}
          accent={absent === 0 ? "success" : "warn"}
        />
        <StatTile
          label="Lessons logged"
          value={total.toString()}
          accent="brand"
        />
      </section>

      {mode === "pick-slot" && rescheduleLesson ? (
        <form action={submitRescheduleRequest} className="space-y-3">
          <input type="hidden" name="lessonId" value={rescheduleLesson.id} />
          <input type="hidden" name="childId" value={selected.id} />
          <input type="hidden" name="month" value={monthIso} />

          <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "60ms" }}>
            <div className="px-6 py-5 border-b border-hairline/60 bg-brand-50">
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
                  className="mt-1 block w-full rounded-lg border border-hairline/70 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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
                No classes available — no tutor teaching{" "}
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
        <Card
          className="p-0 overflow-hidden rise"
          style={{ animationDelay: "60ms" }}
        >
          <SectionHeader
            title={`${selected.firstName}'s schedule`}
            description={
              mode === "pick-lesson"
                ? "Click a lesson to move it. Then pick a new time on the next screen."
                : "Click a lesson to request a reschedule."
            }
          />
          {mode === "pick-lesson" && (
            <div className="px-6 py-3 bg-brand-50 border-b border-hairline/60 flex items-baseline justify-between gap-3">
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
                className="group flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 text-navy-800 px-6 py-3 hover:from-brand-200 hover:via-brand-300 hover:to-brand-200 transition-colors"
              >
                <span className="text-base font-medium">Reschedule a class</span>
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
      )}

      <div className="rise" style={{ animationDelay: "80ms" }}>
        <Card className="p-0 overflow-hidden">
          <SectionHeader
            title="Lesson Log"
            link={{ href: "/parent/feedback", label: "Tutor feedback" }}
          />
          {attendanceRows.length === 0 ? (
            <div className="px-6 py-8 text-sm text-ink-soft">
              No attendance has been recorded yet for {selected.firstName}.
            </div>
          ) : (
            <div className="divide-y divide-hairline/60">
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
                    {r.subjectName ?? "—"}
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

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="rise">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600" />
        Classes
      </div>
      <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
        {subtitle ? `${subtitle}'s Classes` : "Classes"}
      </h1>
    </header>
  );
}
