import Link from "next/link";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead, SectionHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { Label } from "@/components/ui/input";
import { VideoViewerButton } from "@/components/ui/video-viewer";
import { formatDateLong, formatTime } from "@/lib/format";
import { classNameDetail } from "@/lib/class-display";
import { getLessonReschedules } from "@/lib/reschedule";
import { LessonPlanEditor } from "@/app/tutor/_components/lesson-plan-editor";
import {
  saveAttendance,
  saveLessonNote,
  saveLessonRecording,
} from "../../_actions";
import {
  getLessonForTutor,
  getStudentTrialsOnDate,
  requireTutor,
} from "../../_data";

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "left_early", label: "Left early" },
  { value: "absent", label: "Absent" },
  { value: "makeup_attended", label: "Make-up" },
] as const;

// Read-only per-enrolment delivery mode (admin-set). Only render an explicit
// badge when a student deviates from the class default (online / in person);
// a null/default mode shows nothing so the roster row stays uncluttered.
const DELIVERY_BADGE = {
  online: { label: "Online", tone: "info" },
  in_person: { label: "In person", tone: "neutral" },
} as const;

const INPUT_CLS =
  "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

const savedFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function LessonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const cameFromSchedule = from === "schedule";
  const tutor = await requireTutor();
  const { lesson, roster, notes } = await getLessonForTutor(tutor.id, id);
  const notesByStudent = new Map(notes.map((n) => [n.studentId, n]));

  // Reschedules - who moved out of this lesson (and where) and who's a make-up in.
  const { movedOut, movedIn } = await getLessonReschedules(id);
  const movedOutById = new Map(movedOut.map((m) => [m.studentId, m.toLabel]));
  const movedInTrials = await getStudentTrialsOnDate(
    movedIn.map((m) => m.studentId),
    lesson.date,
  );
  const movedInTrialsByStudent = new Map(
    movedInTrials.map((trial) => [trial.studentId, trial]),
  );
  const rosterIds = new Set(roster.map((student) => student.id));
  const noteStudents = [
    ...roster,
    ...movedIn
      .filter((student) => !rosterIds.has(student.studentId))
      .map((student) => ({
        id: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
      })),
  ];
  const classDetail = classNameDetail(lesson.subjectName, lesson.className);

  return (
    <div className="space-y-5">
      <Link
        href={cameFromSchedule ? "/tutor/timetable" : "/tutor"}
        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-ink hover:text-ink"
      >
        ← {cameFromSchedule ? "Schedule & availability" : "Today"}
      </Link>

      <PageHead
        eyebrow={classDetail ? lesson.subjectName : undefined}
        title={classDetail || lesson.subjectName}
        sub={
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            <span>{formatDateLong(lesson.date)}</span>
            <span className="tabular-nums">
              {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
            </span>
            {lesson.location && <span>{lesson.location}</span>}
          </div>
        }
      />

      <Card className="overflow-hidden">
        <CardHead title="Attendance" action={`${roster.length} enrolled`} />
        {roster.length === 0 && movedIn.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted text-center">
            No students are enrolled in this class yet.
          </div>
        ) : roster.length === 0 ? null : (
          <form action={saveAttendance}>
            <input type="hidden" name="lessonId" value={lesson.id} />
            <ul className="divide-y divide-line">
              {roster.map((s) => {
                const current = s.attendanceStatus ?? "";
                return (
                  <li key={s.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-3">
                        <Link
                          href={`/tutor/students/${s.id}`}
                          className="text-[13px] font-bold text-ink hover:text-brand-700"
                        >
                          {s.firstName} {s.lastName}
                        </Link>
                        {s.yearLevel && (
                          <span className="text-[11px] text-muted">
                            {s.yearLevel}
                          </span>
                        )}
                        {s.deliveryMode && (
                          <Pill
                            tone={DELIVERY_BADGE[s.deliveryMode].tone}
                            className="translate-y-[1px]"
                          >
                            {DELIVERY_BADGE[s.deliveryMode].label}
                          </Pill>
                        )}
                        {s.onLeave && (
                          <Pill tone="warn" className="translate-y-[1px]">
                            On leave
                          </Pill>
                        )}
                        {s.onTrial && (
                          <Pill tone="info" className="translate-y-[1px]">
                            Free trial
                          </Pill>
                        )}
                      </div>
                      {movedOutById.has(s.id) && (
                        <span className="inline-flex items-center rounded-full border border-warn/40 bg-warn-bg px-2.5 py-1 text-[11px] font-bold text-warn">
                          Rescheduled → {movedOutById.get(s.id)}
                        </span>
                      )}
                    </div>
                    {s.trialNote && (
                      <div className="rounded-[10px] border border-info/25 bg-info-bg px-3 py-2 text-[12px] leading-relaxed text-info">
                        <span className="font-bold">Free-trial note:</span>{" "}
                        {s.trialNote}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {ATTENDANCE_OPTIONS.map((opt) => (
                        <label key={opt.value} className="cursor-pointer">
                          <input
                            type="radio"
                            name={`status[${s.id}]`}
                            value={opt.value}
                            defaultChecked={current === opt.value}
                            className="peer sr-only"
                          />
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-line bg-surface text-[11px] font-bold text-ink-soft peer-checked:bg-brand-600 peer-checked:text-white peer-checked:border-brand-600 hover:border-brand-300 transition-colors">
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <input
                      name={`note[${s.id}]`}
                      placeholder="Optional note (e.g. arrived 10 min late)"
                      defaultValue={s.attendanceNote ?? ""}
                      className={INPUT_CLS}
                    />
                  </li>
                );
              })}
            </ul>
            <div className="px-4 py-3 border-t border-line bg-surface-2 flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-brand-600 text-white px-4 py-2 text-[12px] font-bold hover:bg-brand-700"
              >
                Save attendance
              </button>
            </div>
          </form>
        )}
        {movedIn.length > 0 && (
          <form action={saveAttendance} className="border-t border-line">
            <input type="hidden" name="lessonId" value={lesson.id} />
            <div className="px-4 pt-3 pb-1.5 text-[10px] uppercase tracking-[0.12em] font-bold text-muted">
              Make-up attendees
            </div>
            <ul className="divide-y divide-line">
              {movedIn.map((m) => {
                const trial = movedInTrialsByStudent.get(m.studentId);
                const trialNote = trial?.note?.trim();
                return (
                  <li key={m.studentId} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <div className="text-[13px] font-bold text-ink">
                          {m.studentName}
                        </div>
                        {trial && <Pill tone="info">Free trial</Pill>}
                      </div>
                      <span className="inline-flex items-center rounded-full border border-good/40 bg-good-bg px-2.5 py-1 text-[11px] font-bold text-good">
                        Make-up ← {m.fromLabel}
                      </span>
                    </div>
                    {trialNote && (
                      <div className="rounded-[10px] border border-info/25 bg-info-bg px-3 py-2 text-[12px] leading-relaxed text-info">
                        <span className="font-bold">Free-trial note:</span>{" "}
                        {trialNote}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {ATTENDANCE_OPTIONS.map((opt) => (
                        <label key={opt.value} className="cursor-pointer">
                          <input
                            type="radio"
                            name={`status[${m.studentId}]`}
                            value={opt.value}
                            defaultChecked={
                              (m.attendanceStatus ?? "makeup_attended") ===
                              opt.value
                            }
                            className="peer sr-only"
                          />
                          <span className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-ink-soft transition-colors hover:border-brand-300 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white">
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <input
                      name={`note[${m.studentId}]`}
                      placeholder="Optional note (e.g. attended a make-up lesson)"
                      defaultValue={m.attendanceNote ?? ""}
                      className={INPUT_CLS}
                    />
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end border-t border-line bg-surface-2 px-4 py-3">
              <button
                type="submit"
                className="rounded-full bg-brand-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-brand-700"
              >
                Save make-up attendance
              </button>
            </div>
          </form>
        )}
      </Card>

      {/* Lesson plan - forward-looking, visible to students + parents */}
      <Card className="overflow-hidden">
        <CardHead
          title="Lesson plan"
          action={<span className="text-[12px] text-muted">What's coming up</span>}
        />
        <CardBody>
          <LessonPlanEditor
            classId={lesson.classId}
            initial={lesson.lessonPlan ?? ""}
          />
        </CardBody>
      </Card>

      {/* Recording link - a hosted video the class's students can watch back */}
      <Card className="overflow-hidden">
        <CardHead
          title="Recording"
          action={
            lesson.recordingUrl ? (
              <span className="text-good">Link added</span>
            ) : (
              <span className="text-muted">Optional</span>
            )
          }
        />
        <CardBody>
          <form action={saveLessonRecording} className="space-y-2.5">
            <input type="hidden" name="lessonId" value={lesson.id} />
            <Label htmlFor="recording-url">Video link</Label>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                id="recording-url"
                name="recordingUrl"
                type="url"
                inputMode="url"
                defaultValue={lesson.recordingUrl ?? ""}
                placeholder="https://youtube.com/… or Vimeo / Drive link"
                className={INPUT_CLS}
              />
              <button
                type="submit"
                className="h-10 shrink-0 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700"
              >
                Save link
              </button>
            </div>
            <p className="text-[12px] text-muted">
              Paste a hosted video URL; students watch it from their Recorded
              lessons. Leave blank and save to remove.
            </p>
            {lesson.recordingUrl && (
              <VideoViewerButton
                url={lesson.recordingUrl}
                title={`${lesson.subjectName} lesson recording`}
              >
                Preview recording
              </VideoViewerButton>
            )}
          </form>
        </CardBody>
      </Card>

      <div>
        <SectionHead title="Lesson notes" />
        {noteStudents.length > 0 && (
          <div className="space-y-3.5">
            {noteStudents.map((s) => {
              const existing = notesByStudent.get(s.id);
              const isMakeup = movedIn.some(
                (student) => student.studentId === s.id,
              );
              return (
                <Card key={s.id} className="overflow-hidden">
                  <CardHead
                    title={`${s.firstName} ${s.lastName}${
                      isMakeup ? " · Make-up attendee" : ""
                    }`}
                    action={
                      existing
                        ? `Last saved ${savedFmt.format(existing.createdAt)}`
                        : "No note yet"
                    }
                  />
                  <form action={saveLessonNote}>
                    <input type="hidden" name="lessonId" value={lesson.id} />
                    <input type="hidden" name="studentId" value={s.id} />
                    <CardBody className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <Label htmlFor={`topic-${s.id}`}>
                            Topic covered
                          </Label>
                          <input
                            id={`topic-${s.id}`}
                            name="topicCovered"
                            defaultValue={existing?.topicCovered ?? ""}
                            placeholder="e.g. Quadratic equations"
                            className={INPUT_CLS}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`perf-${s.id}`}>Performance</Label>
                          <input
                            id={`perf-${s.id}`}
                            name="performance"
                            defaultValue={existing?.performance ?? ""}
                            placeholder="e.g. Engaged, on track"
                            className={INPUT_CLS}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`strong-${s.id}`}>Strengths</Label>
                          <input
                            id={`strong-${s.id}`}
                            name="strengths"
                            defaultValue={existing?.strengths ?? ""}
                            className={INPUT_CLS}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`struggle-${s.id}`}>
                            Struggled with
                          </Label>
                          <input
                            id={`struggle-${s.id}`}
                            name="struggles"
                            defaultValue={existing?.struggles ?? ""}
                            className={INPUT_CLS}
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor={`next-${s.id}`}>
                            Next lesson focus
                          </Label>
                          <input
                            id={`next-${s.id}`}
                            name="nextLessonFocus"
                            defaultValue={existing?.nextLessonFocus ?? ""}
                            className={INPUT_CLS}
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3.5">
                        <div className="rounded-[12px] border border-good/40 bg-good-bg p-3 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-good" />
                            <div className="text-[10px] uppercase tracking-[0.12em] text-good font-bold">
                              Parent will see this
                            </div>
                          </div>
                          <p className="text-[11px] text-ink-soft leading-snug">
                            The student and their parent{" "}
                            <strong>will read this</strong>.
                          </p>
                          <textarea
                            name="parentVisibleComment"
                            defaultValue={existing?.parentVisibleComment ?? ""}
                            rows={4}
                            className={`${INPUT_CLS} h-auto py-2`}
                            placeholder="e.g. Great work today on factorisation."
                          />
                        </div>

                        <div className="rounded-[12px] border border-warn/40 bg-warn-bg p-3 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                            <div className="text-[10px] uppercase tracking-[0.12em] text-warn font-bold">
                              Only you and admin see this
                            </div>
                          </div>
                          <p className="text-[11px] text-ink-soft leading-snug">
                            The parent and student{" "}
                            <strong>will not see this</strong>.
                          </p>
                          <textarea
                            name="internalNote"
                            defaultValue={existing?.internalNote ?? ""}
                            rows={4}
                            className={`${INPUT_CLS} h-auto py-2`}
                            placeholder="e.g. Struggling with focus - check in with parent privately."
                          />
                        </div>
                      </div>
                    </CardBody>
                    <div className="px-4 py-3 border-t border-line bg-surface-2 flex justify-end">
                      <button
                        type="submit"
                        className="rounded-full bg-brand-600 text-white px-4 py-2 text-[12px] font-bold hover:bg-brand-700"
                      >
                        Save note
                      </button>
                    </div>
                  </form>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
