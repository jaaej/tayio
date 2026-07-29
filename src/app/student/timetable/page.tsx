import { Card, CardHead } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
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
    const [lessonRows, homeworkRows, adminContact] = await Promise.all([
      getStudentTimetableLessons(user.id, { from, to }),
      getStudentHomework(user.id),
      getAdminContactForStudent(),
    ]);
    const chips: TimetableChip[] = lessonRows.map((l) => ({
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
      // A moved-out lesson (or one with a pending request) can be rescheduled
      // again - a second move needs approval (enforced server-side) and a new
      // request supersedes the pending one.
      canReschedule:
        l.status === "upcoming" &&
        (l.studentState === "normal" ||
          l.studentState === "moved_out" ||
          l.studentState === "pending_out") &&
        new Date(`${l.date}T${l.startTime}`).getTime() > now.getTime(),
    }));
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
          sub="Click a lesson to open it, then choose Go to subject or Reschedule."
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
