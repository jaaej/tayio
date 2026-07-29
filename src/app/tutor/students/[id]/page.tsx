import Link from "next/link";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { StatChip } from "@/components/student/stat-chip";
import { formatDateShort, relativeTime } from "@/lib/format";
import {
  ATTENDANCE_STATUS_LABEL,
  HOMEWORK_STATUS_LABEL,
} from "@/lib/status";
import { getStudentProfile, requireTutor } from "../../_data";

const ATTENDANCE_TONE: Record<string, "good" | "warn" | "bad" | "info" | "neutral"> = {
  present: "good",
  late: "warn",
  absent: "bad",
  left_early: "warn",
  makeup_attended: "info",
};

const HW_TONE: Record<string, "good" | "warn" | "bad" | "info" | "neutral"> = {
  marked: "good",
  submitted: "good",
  returned: "good",
  late: "bad",
  resubmission_requested: "warn",
  viewed: "info",
  not_started: "neutral",
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

  const presentCount = attendance.filter(
    (a) => a.status === "present" || a.status === "makeup_attended",
  ).length;
  const totalAttendance = attendance.length;
  const attendanceRate = totalAttendance
    ? Math.round((presentCount / totalAttendance) * 100)
    : null;

  return (
    <div className="space-y-5">
      <Link
        href="/tutor/students"
        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-600 hover:text-brand-700"
      >
        ← All students
      </Link>

      <PageHead
        eyebrow={
          [student.yearLevel, student.email].filter(Boolean).join(" · ") ||
          undefined
        }
        title={`${student.firstName} ${student.lastName}`}
        actions={
          <a
            href={`/tutor/messages/with/${id}`}
            className="rounded-full bg-brand-600 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-brand-700"
          >
            Message student
          </a>
        }
      />

      <div className="grid grid-cols-3 gap-3.5">
        <StatChip
          icon="✓"
          hue={
            attendanceRate === null
              ? "brand"
              : attendanceRate >= 90
                ? "mint"
                : attendanceRate >= 70
                  ? "sun"
                  : "coral"
          }
          value={attendanceRate === null ? "-" : `${attendanceRate}%`}
          label="Attendance rate"
        />
        <StatChip
          icon="📝"
          hue="brand"
          value={homework.length}
          label="Homework"
        />
        <StatChip
          icon="📓"
          hue="grape"
          value={notes.length}
          label="Lesson notes"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHead title="Attendance history" action={`${attendance.length} record${attendance.length === 1 ? "" : "s"}`} />
        <CardBody tight>
          {attendance.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              No attendance recorded yet.
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {attendance.slice(0, 10).map((a) => (
                <li
                  key={a.lessonId}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="w-24 text-[12px] text-muted tabular-nums shrink-0">
                    {formatDateShort(a.lessonDate)}
                  </div>
                  <div className="flex-1 text-[13px] text-ink truncate font-bold">
                    {a.className}
                  </div>
                  <Pill tone={ATTENDANCE_TONE[a.status] ?? "neutral"}>
                    {ATTENDANCE_STATUS_LABEL[a.status] ?? a.status}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHead title="Homework" action={`${homework.length} item${homework.length === 1 ? "" : "s"}`} />
        <CardBody tight>
          {homework.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              No homework assigned yet.
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {homework.map((h) => (
                <li key={h.homeworkId}>
                  <Link
                    href={`/tutor/homework/${h.homeworkId}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-ink truncate">
                        {h.title}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        Due{" "}
                        {formatDateShort(
                          new Date(h.dueDate).toISOString().slice(0, 10),
                        )}
                      </div>
                    </div>
                    {h.score !== null && (
                      <Pill tone="info">{h.score}</Pill>
                    )}
                    <Pill tone={HW_TONE[h.status] ?? "neutral"}>
                      {HOMEWORK_STATUS_LABEL[h.status] ?? h.status}
                    </Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHead title="Lesson notes" action={`${notes.length} entr${notes.length === 1 ? "y" : "ies"}`} />
        <CardBody tight>
          {notes.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              No lesson notes yet.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {notes.map((n) => (
                <article key={n.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-ink truncate">
                        {n.className}
                        {n.topicCovered ? (
                          <span className="text-muted">
                            {" "}
                            · {n.topicCovered}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {relativeTime(new Date(n.createdAt))}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted tabular-nums shrink-0">
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
        </CardBody>
      </Card>
    </div>
  );
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
  const cls =
    tone === "parent"
      ? "border-good/30 bg-good-bg"
      : "border-warn/30 bg-warn-bg";
  const labelCls = tone === "parent" ? "text-good" : "text-warn";
  return (
    <div className={`rounded-[12px] border ${cls} p-3`}>
      <div
        className={`text-[10px] uppercase tracking-[0.12em] font-bold ${labelCls}`}
      >
        {label}
      </div>
      <p className="mt-1.5 text-[13px] text-ink whitespace-pre-wrap leading-snug">
        {body}
      </p>
    </div>
  );
}
