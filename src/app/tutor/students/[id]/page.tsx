import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ScoreBadge } from "@/components/data/score-badge";
import { StatTile } from "@/components/data/stat-tile";
import { StatusBadge } from "@/components/data/status-badge";
import { formatDateShort, relativeTime } from "@/lib/format";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_STYLE,
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
} from "@/lib/status";
import { getStudentProfile, requireTutor } from "../../_data";

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

  const presentCount = attendance.filter(
    (a) => a.status === "present" || a.status === "makeup_attended",
  ).length;
  const totalAttendance = attendance.length;
  const attendanceRate = totalAttendance
    ? Math.round((presentCount / totalAttendance) * 100)
    : null;

  return (
    <div className="space-y-6">
      <header className="rise space-y-2">
        <Link
          href="/tutor/students"
          className="text-[11px] uppercase tracking-[0.16em] text-muted hover:text-ink"
        >
          ← All students
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
            {student.firstName} {student.lastName}
          </h1>
          <a
            href={`/tutor/messages/with/${id}`}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors uppercase tracking-[0.14em]"
          >
            Message student
          </a>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
          {student.yearLevel && <span>{student.yearLevel}</span>}
          {student.school && <span>{student.school}</span>}
          <span>{student.email}</span>
        </div>
      </header>

      <section
        className="grid grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Attendance rate"
          value={attendanceRate === null ? "—" : `${attendanceRate}%`}
          sub={`${totalAttendance} marked lesson${totalAttendance === 1 ? "" : "s"}`}
          accent={
            attendanceRate === null
              ? "muted"
              : attendanceRate >= 90
                ? "success"
                : attendanceRate >= 70
                  ? "brand"
                  : "warn"
          }
        />
        <StatTile
          label="Homework"
          value={homework.length.toString()}
          sub={`assignment${homework.length === 1 ? "" : "s"} from you`}
          accent="brand"
        />
        <StatTile
          label="Lesson notes"
          value={notes.length.toString()}
          sub="written by you"
          accent="brand"
        />
      </section>

      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "80ms" }}>
        <SectionHeader title="Attendance History" />
        {attendance.length === 0 ? (
          <Empty>No attendance recorded yet.</Empty>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {attendance.slice(0, 10).map((a) => (
              <li
                key={a.lessonId}
                className="flex items-center gap-4 px-6 py-3.5"
              >
                <div className="w-28 text-sm text-ink-soft tabular-nums shrink-0">
                  {formatDateShort(a.lessonDate)}
                </div>
                <div className="flex-1 text-base text-ink truncate">
                  {a.className}
                </div>
                <StatusBadge
                  label={ATTENDANCE_STATUS_LABEL[a.status] ?? a.status}
                  className={ATTENDANCE_STATUS_STYLE[a.status]}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "120ms" }}>
        <SectionHeader title="Homework" />
        {homework.length === 0 ? (
          <Empty>No homework assigned yet.</Empty>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {homework.map((h) => (
              <li key={h.homeworkId}>
                <Link
                  href={`/tutor/homework/${h.homeworkId}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-ink truncate">
                      {h.title}
                    </div>
                    <div className="text-sm text-muted mt-0.5">
                      Due {formatDateShort(new Date(h.dueDate).toISOString().slice(0, 10))}
                    </div>
                  </div>
                  {h.score !== null && <ScoreBadge score={String(h.score)} />}
                  <StatusBadge
                    label={HOMEWORK_STATUS_LABEL[h.status] ?? h.status}
                    className={HOMEWORK_STATUS_STYLE[h.status]}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "160ms" }}>
        <SectionHeader title="Lesson Notes" />
        {notes.length === 0 ? (
          <Empty>No lesson notes yet.</Empty>
        ) : (
          <div className="divide-y divide-hairline/60">
            {notes.map((n) => (
              <article key={n.id} className="px-6 py-5 space-y-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base text-ink truncate">
                      {n.className}
                      {n.topicCovered ? (
                        <span className="text-muted"> · {n.topicCovered}</span>
                      ) : null}
                    </div>
                    <div className="text-sm text-muted mt-0.5">
                      {relativeTime(new Date(n.createdAt))}
                    </div>
                  </div>
                  <div className="text-xs text-muted tabular-nums shrink-0">
                    {formatDateShort(n.lessonDate)}
                  </div>
                </div>
                {n.parentVisibleComment && (
                  <NoteBlock
                    tone="parent"
                    label="Parent will see this"
                    body={n.parentVisibleComment}
                  />
                )}
                {n.internalNote && (
                  <NoteBlock
                    tone="internal"
                    label="Only you and admin see this"
                    body={n.internalNote}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100">
      <div className="text-xl font-medium text-ink uppercase tracking-wide">{title}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-8 text-sm text-ink-soft">{children}</div>;
}

function NoteBlock({
  tone,
  label,
  body,
}: {
  tone: "parent" | "internal";
  label: string;
  body: string;
}) {
  const styles =
    tone === "parent"
      ? "border-emerald-200 bg-emerald-50/40"
      : "border-amber-200 bg-amber-50/40";
  const labelStyle =
    tone === "parent" ? "text-emerald-800" : "text-amber-800";
  return (
    <div className={`rounded-xl border ${styles} p-4`}>
      <div
        className={`text-[10px] uppercase tracking-[0.18em] font-medium ${labelStyle}`}
      >
        {label}
      </div>
      <p className="mt-2 text-sm text-ink whitespace-pre-wrap leading-relaxed">
        {body}
      </p>
    </div>
  );
}
