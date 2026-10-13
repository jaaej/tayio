import Link from "next/link";
import { PageHeader, buttonVariants } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { parseMonthParam } from "../_components/month-calendar";
import {
  InteractiveTimetable,
  RailCard,
  type TimetableHw,
} from "../_components/interactive-timetable";
import { termAllowanceLabel } from "../_components/timetable-helpers";
import { getAdminContactForStudent, getStudentHomework } from "../_lib/queries";
import { listRedeemableCredits } from "@/lib/credits";
import { buildTimetableChips } from "@/app/_lib/timetable-chips";
import { getClassMoveData } from "@/lib/class-moves";
import { ClassMoveRequestPanel } from "@/components/class-moves/request-panel";

type SearchParams = Promise<{ month?: string }>;

function isoLocal(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * One timetable for both student levels. A student with billing access
 * (`student_unrestricted`) can reschedule, cancel and spend class credits; a
 * base student sees the same calendar and lesson details and is pointed to a
 * parent. The reschedule/cancel/credit server actions enforce the same split.
 */
export default async function TimetablePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("student");
  const isUnrestricted =
    (user.app_metadata?.role as string | undefined) === "student_unrestricted";
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);

  // The calendar moves month by month on the client, so load a window around
  // the requested month; moving it updates ?month and re-centres the window.
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month + 3, 1);
  const [chips, homeworkRows, classMoves, adminContact, credits] = await Promise.all([
    buildTimetableChips(user.id, from, to),
    getStudentHomework(user.id),
    getClassMoveData(user.id),
    isUnrestricted ? getAdminContactForStudent() : Promise.resolve(null),
    isUnrestricted ? listRedeemableCredits(user.id) : Promise.resolve([]),
  ]);

  const fromIso = isoLocal(from);
  const toIso = isoLocal(to);
  const homework: TimetableHw[] = homeworkRows
    .map((h) => ({
      id: h.homeworkId,
      dueDate: isoLocal(h.dueDate),
      title: h.title,
      done: h.status === "submitted" || h.status === "marked",
      href: `/student/homework/${h.homeworkId}`,
    }))
    .filter((h) => h.dueDate >= fromIso && h.dueDate < toIso);

  const allowance = isUnrestricted ? termAllowanceLabel(chips, new Date()) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Timetable"
        sub={allowance ?? undefined}
        actions={
          isUnrestricted ? (
            adminContact && (
              <Link
                href={`/student/messages/with/${adminContact.id}`}
                className={buttonVariants({ variant: "glass", size: "lg" })}
              >
                Message the office
              </Link>
            )
          ) : (
            <Link href="/student/homework" className={buttonVariants({ variant: "glass", size: "lg" })}>
              Homework
            </Link>
          )
        }
      />
      <InteractiveTimetable
        initialYear={year}
        initialMonth={month}
        lessons={chips}
        homework={homework}
        credits={credits}
        adminId={adminContact?.id ?? null}
        canSelfServe={isUnrestricted}
        glass
        aside={
          <RailCard key="class-move" glass title="Permanent class time" titleId="timetable-class-move">
            <ClassMoveRequestPanel
              studentId={user.id}
              classes={classMoves.classes}
              requests={classMoves.requests}
              headless
            />
          </RailCard>
        }
      />
    </div>
  );
}
