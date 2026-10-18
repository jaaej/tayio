import Link from "next/link";
import { PageHeader, buttonVariants } from "@/components/admin/ui";
import { ClassMoveRequestPanel } from "@/components/class-moves/request-panel";
import { AttendancePanel } from "@/components/parent/attendance-panel";
import { InteractiveTimetable, RailCard } from "@/app/student/_components/interactive-timetable";
import { termAllowanceLabel } from "@/app/student/_components/timetable-helpers";
import { buildTimetableChips, buildTimetableHomework } from "@/app/_lib/timetable-chips";
import { getStudentHomework } from "@/app/student/_lib/queries";
import { requireRole } from "@/lib/auth";
import { getClassMoveData } from "@/lib/class-moves";
import { listRedeemableCredits } from "@/lib/credits";
import { parseMonthParam } from "@/lib/month-param";
import { getAdminContact, getAttendance, resolveSelectedChild } from "../_data";
import { EmptyChildrenNotice } from "../_components/empty-children";

type SearchParams = Promise<{
  child?: string;
  month?: string;
  /** Opens with this lesson selected (the Overview's "Can't make it?"). */
  lesson?: string;
}>;

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The child's timetable: the student's own Timetable (month calendar,
 * selected lesson with reschedule and cancel, class credits, permanent
 * class time), with every marked lesson's attendance underneath.
 */
export default async function ParentTimetablePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const params = await searchParams;
  const { selected } = await resolveSelectedChild(user.id, params.child);

  if (!selected) {
    return (
      <div className="space-y-5">
        <PageHeader title="Timetable" />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const { year, month } = parseMonthParam(params.month);
  // The calendar moves month by month on the client, so load a window around
  // the requested month - the same window as the student's own timetable.
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month + 3, 1);

  const [chips, homeworkRows, attendanceRows, credits, admin, classMoves] = await Promise.all([
    buildTimetableChips(selected.id, from, to),
    getStudentHomework(selected.id),
    getAttendance(selected.id),
    listRedeemableCredits(selected.id),
    getAdminContact(),
    getClassMoveData(selected.id),
  ]);

  const homework = buildTimetableHomework(
    homeworkRows,
    { fromIso: isoLocal(from), toIso: isoLocal(to) },
    (id) => `/parent/homework/${id}?child=${selected.id}`,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${selected.firstName}'s timetable`}
        sub={termAllowanceLabel(chips, new Date()) ?? undefined}
        actions={
          admin && (
            <Link
              href={`/parent/messages/with/${admin.id}`}
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              Message the office
            </Link>
          )
        }
      />
      <InteractiveTimetable
        key={selected.id}
        initialYear={year}
        initialMonth={month}
        lessons={chips}
        homework={homework}
        credits={credits}
        adminId={admin?.id ?? null}
        studentId={selected.id}
        subjectBase="/parent/subjects"
        subjectQuery={`?child=${selected.id}`}
        messageBase="/parent/messages/with"
        recapBase="/parent/feedback"
        initialLessonId={params.lesson}
        glass
        aside={
          <RailCard key="class-move" glass title="Permanent class time" titleId="timetable-class-move">
            <ClassMoveRequestPanel
              studentId={selected.id}
              studentName={selected.firstName}
              classes={classMoves.classes}
              requests={classMoves.requests}
              headless
            />
          </RailCard>
        }
      />
      <AttendancePanel id="attendance" rows={attendanceRows} childFirstName={selected.firstName} />
    </div>
  );
}
