import { Card, CardHead } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { CreditPanel } from "@/components/reschedule/credit-panel";
import { requireRole } from "@/lib/auth";
import {
  MonthCalendar,
  monthBounds,
  parseMonthParam,
  type MonthHomework,
  type MonthLesson,
} from "../_components/month-calendar";
import {
  InteractiveTimetable,
  type TimetableChip,
  type TimetableHw,
} from "../_components/interactive-timetable";
import {
  getAdminContactForStudent,
  getStudentHomework,
  getStudentTimetableLessons,
} from "../_lib/queries";
import {
  getCancellationsUsed,
  getReschedulesUsed,
  getTerms,
  listRedeemableCredits,
} from "@/lib/credits";
import {
  CANCEL_CAP,
  RESCHEDULE_CAP,
  meetsCancelNotice,
  meetsRescheduleNotice,
  remaining,
  resolveTerm,
  type TermRow,
} from "@/lib/reschedule-credits";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type SearchParams = Promise<{ month?: string }>;

function isoLocal(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("student");
  const isUnrestricted =
    (user.app_metadata?.role as string | undefined) === "student_unrestricted";
  const firstName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Your";
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() === month;

  // Unrestricted students get the interactive timetable (click a lesson to go
  // to the subject or reschedule it inline). It manages the month client-side,
  // so load a wide window of data.
  if (isUnrestricted) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month + 3, 1);
    const [lessonRows, homeworkRows, adminContact, terms, credits] = await Promise.all([
      getStudentTimetableLessons(user.id, { from, to }),
      getStudentHomework(user.id),
      getAdminContactForStudent(),
      getTerms(),
      listRedeemableCredits(user.id),
    ]);

    // Base self-serve eligibility: lesson is upcoming, in the future, and in
    // a state a cancel/reschedule makes sense for (a moved-out or
    // pending-out lesson can still be re-actioned; a make-up/pending-in chip
    // cannot). Resolve each eligible lesson's term once, then fetch that
    // term's used counts once per distinct term (not once per lesson).
    function isManageable(l: (typeof lessonRows)[number]) {
      return (
        l.status === "upcoming" &&
        (l.studentState === "normal" ||
          l.studentState === "moved_out" ||
          l.studentState === "pending_out") &&
        new Date(`${l.date}T${l.startTime}`).getTime() > now.getTime()
      );
    }
    const termByLessonId = new Map<string, TermRow | null>();
    for (const l of lessonRows) {
      if (isManageable(l)) termByLessonId.set(l.id, resolveTerm(l.date, terms));
    }
    const distinctTermIds = Array.from(
      new Set(
        Array.from(termByLessonId.values())
          .filter((t): t is TermRow => t !== null)
          .map((t) => t.id),
      ),
    );
    const usageByTerm = new Map<string, { cancelUsed: number; rescheduleUsed: number }>();
    await Promise.all(
      distinctTermIds.map(async (termId) => {
        const [cancelUsed, rescheduleUsed] = await Promise.all([
          getCancellationsUsed(user.id, termId),
          getReschedulesUsed(user.id, termId),
        ]);
        usageByTerm.set(termId, { cancelUsed, rescheduleUsed });
      }),
    );

    const chips: TimetableChip[] = lessonRows.map((l) => {
      const canManage = isManageable(l);
      const term = termByLessonId.get(l.id) ?? null;
      const usage = term ? usageByTerm.get(term.id) : undefined;
      const cancelRemaining = usage ? remaining(CANCEL_CAP, usage.cancelUsed) : null;
      const rescheduleRemaining = usage ? remaining(RESCHEDULE_CAP, usage.rescheduleUsed) : null;
      // Cancel is narrower than the shared "canManage" base: a lesson that's
      // already been moved (moved_out/pending_out) must not also be
      // cancellable - that would grant a second credit for the same slot
      // while the make-up lesson still stands. Reschedule intentionally
      // keeps the wider base (re-rescheduling a moved lesson is safe - it
      // just supersedes the previous move).
      const canCancel =
        canManage &&
        l.studentState === "normal" &&
        term !== null &&
        meetsCancelNotice(now, l.date, l.startTime) &&
        (cancelRemaining ?? 0) > 0;
      const canReschedule =
        canManage &&
        term !== null &&
        meetsRescheduleNotice(now, l.date, l.startTime) &&
        (rescheduleRemaining ?? 0) > 0;
      return {
        id: l.id,
        date: l.date,
        startTime: l.startTime,
        endTime: l.endTime,
        status: l.status,
        subjectId: l.subjectId,
        subjectName: l.subjectName,
        className: l.className,
        studentState: l.studentState,
        moveLabel: l.moveLabel,
        canManage,
        canReschedule,
        canCancel,
        rescheduleRemaining,
        cancelRemaining,
      };
    });
    const fromIso = isoLocal(from);
    const toIso = isoLocal(to);
    const hw: TimetableHw[] = homeworkRows
      .map((h) => ({
        id: h.homeworkId,
        dueDate: isoLocal(h.dueDate),
        title: h.title,
        done: h.status === "submitted" || h.status === "marked",
      }))
      .filter((h) => h.dueDate >= fromIso && h.dueDate < toIso);

    return (
      <div className="space-y-5">
        <PageHead
          eyebrow="Timetable"
          title="Your schedule"
          sub="Click a lesson to open it, then choose Go to subject, Reschedule, or Cancel."
        />
        <Card className="overflow-hidden">
          <div className="p-4 lg:p-5">
            <InteractiveTimetable
              initialYear={year}
              initialMonth={month}
              lessons={chips}
              homework={hw}
              adminId={adminContact?.id ?? null}
            />
          </div>
        </Card>
        <CreditPanel credits={credits} adminId={adminContact?.id ?? null} />
      </div>
    );
  }

  // Restricted students: static month calendar.
  const { fromIso, toIso } = monthBounds(year, month);
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  const [lessonRows, homeworkRows] = await Promise.all([
    getStudentTimetableLessons(user.id, { from, to }),
    getStudentHomework(user.id),
  ]);

  const lessons: MonthLesson[] = lessonRows.map((l) => ({
    id: l.id,
    date: l.date,
    startTime: l.startTime,
    endTime: l.endTime,
    status: l.status,
    subjectName: l.subjectName,
    className: l.className,
    studentState: l.studentState,
    moveLabel: l.moveLabel,
  }));

  const homework: MonthHomework[] = homeworkRows
    .filter((h) => {
      const due = isoLocal(h.dueDate);
      return due >= fromIso && due < toIso;
    })
    .map((h) => ({
      id: h.homeworkId,
      dueDate: isoLocal(h.dueDate),
      title: h.title,
      status: h.status,
      className: h.className,
    }));

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Timetable"
        title={isCurrentMonth ? "Your schedule" : `${MONTH_NAMES[month]} ${year}`}
        sub={
          isCurrentMonth
            ? "Browse upcoming lessons and homework due dates."
            : undefined
        }
      />
      <Card className="overflow-hidden">
        <CardHead
          title={`${firstName}'s schedule`}
          action={`${lessons.length} lesson${lessons.length === 1 ? "" : "s"}`}
        />
        <div className="p-4 lg:p-5">
          <MonthCalendar
            year={year}
            month={month}
            lessons={lessons}
            homework={homework}
            basePath="/student/timetable"
          />
        </div>
      </Card>
    </div>
  );
}
