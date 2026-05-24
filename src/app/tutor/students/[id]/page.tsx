import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { getStudentProfile, requireTutor } from "../../_data";

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  left_early: "Left early",
  makeup_attended: "Make-up",
};

const ATTENDANCE_TONE: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-800 border-emerald-200",
  absent: "bg-rose-50 text-rose-800 border-rose-200",
  late: "bg-amber-50 text-amber-800 border-amber-200",
  left_early: "bg-amber-50 text-amber-800 border-amber-200",
  makeup_attended: "bg-sky-50 text-sky-800 border-sky-200",
};

const HOMEWORK_LABEL: Record<string, string> = {
  not_started: "Not started",
  viewed: "Viewed",
  submitted: "Submitted",
  late: "Late",
  marked: "Marked",
  returned: "Returned",
  resubmission_requested: "Resubmit",
};

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tutor = await requireTutor();
  const { student, attendance, notes, homework } = await getStudentProfile(
    tutor.id,
    id,
  );

  const presentCount = attendance.filter((a) => a.status === "present" || a.status === "makeup_attended").length;
  const totalAttendance = attendance.length;
  const attendanceRate = totalAttendance
    ? Math.round((presentCount / totalAttendance) * 100)
    : null;

  return (
    <div className="space-y-12">
      <header className="rise space-y-3">
        <Link
          href="/tutor/students"
          className="text-[11px] uppercase tracking-[0.16em] text-muted hover:text-ink"
        >
          ← All students
        </Link>
        <h1 className="text-4xl lg:text-5xl font-light tracking-tight text-ink">
          {student.firstName}{" "}
          <span className="font-display italic">{student.lastName}</span>
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
          {student.yearLevel && <span>{student.yearLevel}</span>}
          {student.school && <span>{student.school}</span>}
          <span>{student.email}</span>
        </div>
      </header>

      <section className="grid lg:grid-cols-3 gap-5 rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardLabel>Attendance rate</CardLabel>
          <div className="mt-2 text-3xl font-light text-ink">
            {attendanceRate === null ? "—" : `${attendanceRate}%`}
          </div>
          <div className="mt-2 text-xs text-muted">
            {totalAttendance} marked lesson{totalAttendance === 1 ? "" : "s"}
          </div>
        </Card>
        <Card>
          <CardLabel>Homework</CardLabel>
          <div className="mt-2 text-3xl font-light text-ink tabular-nums">
            {homework.length}
          </div>
          <div className="mt-2 text-xs text-muted">
            assignment{homework.length === 1 ? "" : "s"} from you
          </div>
        </Card>
        <Card>
          <CardLabel>Lesson notes</CardLabel>
          <div className="mt-2 text-3xl font-light text-ink tabular-nums">
            {notes.length}
          </div>
          <div className="mt-2 text-xs text-muted">
            written by you
          </div>
        </Card>
      </section>

      <section className="rise space-y-4" style={{ animationDelay: "160ms" }}>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Attendance history
        </h2>
        {attendance.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">No attendance recorded yet.</p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <ul className="divide-y divide-hairline">
              {attendance.slice(0, 10).map((a) => (
                <li
                  key={a.lessonId}
                  className="flex items-center gap-6 px-6 py-4"
                >
                  <div className="w-28 text-sm text-ink tabular-nums">
                    {dateFmt.format(new Date(a.lessonDate))}
                  </div>
                  <div className="flex-1 text-sm text-ink-soft">
                    {a.className}
                  </div>
                  <span
                    className={`text-[11px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-full border ${
                      ATTENDANCE_TONE[a.status] ??
                      "bg-muted/10 text-ink-soft border-hairline"
                    }`}
                  >
                    {ATTENDANCE_LABEL[a.status] ?? a.status}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="rise space-y-4" style={{ animationDelay: "200ms" }}>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Homework
        </h2>
        {homework.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">No homework assigned yet.</p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <ul className="divide-y divide-hairline">
              {homework.map((h) => (
                <li
                  key={h.homeworkId}
                  className="flex items-center gap-6 px-6 py-4"
                >
                  <div className="flex-1">
                    <div className="text-sm text-ink">{h.title}</div>
                    <div className="text-xs text-muted mt-0.5">
                      Due {dateFmt.format(new Date(h.dueDate))}
                      {h.score !== null ? ` · scored ${h.score}` : ""}
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    {HOMEWORK_LABEL[h.status] ?? h.status}
                  </span>
                  <Link
                    href={`/tutor/homework/${h.homeworkId}`}
                    className="text-[11px] uppercase tracking-[0.16em] text-brand-700"
                  >
                    Open →
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="rise space-y-4" style={{ animationDelay: "240ms" }}>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Lesson notes
        </h2>
        {notes.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">No lesson notes yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {notes.map((n) => (
              <Card key={n.id} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm text-ink">
                    {n.className}
                    {n.topicCovered ? (
                      <span className="text-ink-soft"> · {n.topicCovered}</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted tabular-nums">
                    {dateFmt.format(new Date(n.lessonDate))}
                  </div>
                </div>
                {n.parentVisibleComment && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-800">
                      Parent-visible
                    </div>
                    <p className="mt-2 text-sm text-ink whitespace-pre-wrap">
                      {n.parentVisibleComment}
                    </p>
                  </div>
                )}
                {n.internalNote && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-amber-800">
                      Internal · tutor &amp; admin only
                    </div>
                    <p className="mt-2 text-sm text-ink whitespace-pre-wrap">
                      {n.internalNote}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
