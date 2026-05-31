import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatDateLong, formatTime } from "@/lib/format";
import { saveAttendance, saveLessonNote } from "../../_actions";
import { getLessonForTutor, requireTutor } from "../../_data";

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "left_early", label: "Left early" },
  { value: "absent", label: "Absent" },
  { value: "makeup_attended", label: "Make-up" },
] as const;

const savedFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tutor = await requireTutor();
  const { lesson, roster, notes } = await getLessonForTutor(tutor.id, id);
  const notesByStudent = new Map(notes.map((n) => [n.studentId, n]));

  return (
    <div className="space-y-6">
      <header className="rise space-y-2">
        <Link
          href="/tutor"
          className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
        >
          ← Today
        </Link>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          {lesson.className}
        </h1>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
          <span>{formatDateLong(lesson.date)}</span>
          <span className="tabular-nums">
            {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
          </span>
          <span>{lesson.subjectName}</span>
          {lesson.location && <span>{lesson.location}</span>}
        </div>
      </header>

      {/* Attendance */}
      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "40ms" }}>
        <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between">
          <div className="text-xl font-medium text-ink">Attendance</div>
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            {roster.length} enrolled
          </span>
        </div>

        {roster.length === 0 ? (
          <div className="px-6 py-8 text-sm text-ink-soft">
            No students are enrolled in this class yet.
          </div>
        ) : (
          <form action={saveAttendance}>
            <input type="hidden" name="lessonId" value={lesson.id} />
            <ul className="divide-y divide-hairline/60">
              {roster.map((s) => {
                const current = s.attendanceStatus ?? "";
                return (
                  <li key={s.id} className="px-6 py-4 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <Link
                          href={`/tutor/students/${s.id}`}
                          className="text-base text-ink hover:underline underline-offset-4"
                        >
                          {s.firstName} {s.lastName}
                        </Link>
                        {s.yearLevel && (
                          <span className="ml-3 text-sm text-muted">
                            {s.yearLevel}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ATTENDANCE_OPTIONS.map((opt) => (
                        <label key={opt.value} className="cursor-pointer">
                          <input
                            type="radio"
                            name={`status[${s.id}]`}
                            value={opt.value}
                            defaultChecked={current === opt.value}
                            className="peer sr-only"
                          />
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-hairline text-xs text-ink-soft peer-checked:bg-ink peer-checked:text-white peer-checked:border-ink hover:border-brand-400 transition-colors">
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <Input
                      name={`note[${s.id}]`}
                      placeholder="Optional note (e.g. arrived 10 min late)"
                      defaultValue={s.attendanceNote ?? ""}
                      className="h-9 text-sm"
                    />
                  </li>
                );
              })}
            </ul>
            <div className="px-6 py-4 border-t border-hairline/60 bg-brand-50/40 flex justify-end">
              <Button type="submit" size="sm" variant="primary">
                Save attendance
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Lesson notes */}
      <section className="rise space-y-4" style={{ animationDelay: "80ms" }}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-medium text-ink">Lesson notes</h2>
          <span className="text-sm text-muted">One note per student.</span>
        </div>

        {roster.length === 0 ? null : (
          <div className="space-y-4">
            {roster.map((s) => {
              const existing = notesByStudent.get(s.id);
              return (
                <Card key={s.id} className="space-y-5">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-lg font-medium text-ink">
                      {s.firstName} {s.lastName}
                    </h3>
                    {existing && (
                      <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
                        Last saved {savedFmt.format(existing.createdAt)}
                      </span>
                    )}
                  </div>

                  <form action={saveLessonNote} className="space-y-5">
                    <input type="hidden" name="lessonId" value={lesson.id} />
                    <input type="hidden" name="studentId" value={s.id} />

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`topic-${s.id}`}>Topic covered</Label>
                        <Input
                          id={`topic-${s.id}`}
                          name="topicCovered"
                          defaultValue={existing?.topicCovered ?? ""}
                          placeholder="e.g. Quadratic equations"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`perf-${s.id}`}>Performance</Label>
                        <Input
                          id={`perf-${s.id}`}
                          name="performance"
                          defaultValue={existing?.performance ?? ""}
                          placeholder="e.g. Engaged, on track"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`strong-${s.id}`}>Strengths</Label>
                        <Input
                          id={`strong-${s.id}`}
                          name="strengths"
                          defaultValue={existing?.strengths ?? ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`struggle-${s.id}`}>
                          Struggled with
                        </Label>
                        <Input
                          id={`struggle-${s.id}`}
                          name="struggles"
                          defaultValue={existing?.struggles ?? ""}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`next-${s.id}`}>
                          Next lesson focus
                        </Label>
                        <Input
                          id={`next-${s.id}`}
                          name="nextLessonFocus"
                          defaultValue={existing?.nextLessonFocus ?? ""}
                        />
                      </div>
                    </div>

                    {/* Parent vs internal — strong visual separation */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-900 font-medium">
                            Parent will see this
                          </div>
                        </div>
                        <p className="text-xs text-emerald-900/80 leading-relaxed">
                          The student and their parent <strong>will read this</strong>.
                          Write what's appropriate for them to see.
                        </p>
                        <textarea
                          name="parentVisibleComment"
                          defaultValue={existing?.parentVisibleComment ?? ""}
                          rows={4}
                          className="w-full rounded-xl border border-emerald-300 bg-card p-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          placeholder="e.g. Great work today on factorisation. Keep practising the trickier worked examples this week."
                        />
                      </div>

                      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                          <div className="text-[11px] uppercase tracking-[0.16em] text-amber-900 font-medium">
                            Only you and admin see this
                          </div>
                        </div>
                        <p className="text-xs text-amber-900/80 leading-relaxed">
                          The parent and student <strong>will not see this</strong>.
                          Safe for behavioural or strategy notes.
                        </p>
                        <textarea
                          name="internalNote"
                          defaultValue={existing?.internalNote ?? ""}
                          rows={4}
                          className="w-full rounded-xl border border-amber-300 bg-card p-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="e.g. Struggling with focus — worth checking in with parent privately."
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-hairline/60">
                      <Button type="submit" size="sm">
                        Save note
                      </Button>
                    </div>
                  </form>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
