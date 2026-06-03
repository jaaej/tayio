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
import { getStudentHomework, getStudentLessons } from "../_lib/queries";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type SearchParams = Promise<{ month?: string }>;

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("student");
  const firstName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Your";
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);
  const { fromIso, toIso } = monthBounds(year, month);

  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);

  const [lessonRows, homeworkRows] = await Promise.all([
    getStudentLessons(user.id, { from, to }),
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
  }));

  // Filter homework to this month by due date
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

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Timetable"
        title={
          isCurrentMonth
            ? "Your schedule"
            : `${MONTH_NAMES[month]} ${year}`
        }
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

function isoLocal(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
