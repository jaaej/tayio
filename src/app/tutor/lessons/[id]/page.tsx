import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { saveAttendance, saveLessonNote } from "../../_actions";
import { getLessonForTutor, requireTutor } from "../../_data";

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "left_early", label: "Left early" },
  { value: "absent", label: "Absent" },
  { value: "makeup_attended", label: "Make-up" },
] as const;

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
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
    <div className="space-y-12">
      <header className="rise space-y-3">
        <Link
          href="/tutor"
          className="text-[11px] uppercase tracking-[0.16em] text-muted hover:text-ink"
        >
          ← Today
        </Link>
        <h1 className="text-4xl lg:text-5xl font-light tracking-tight text-ink">
          {lesson.className}{" "}
          <span className="">lesson</span>
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
          <span>{dateFmt.format(new Date(lesson.date))}</span>
          <span className="tabular-nums">
            {lesson.startTime.slice(0, 5)}–{lesson.endTime.slice(0, 5)}
          </span>
          <span>{lesson.subjectName}</span>
          {lesson.location && <span>{lesson.location}</span>}
        </div>
      </header>

      <section className="rise space-y-4" style={{ animationDelay: "80ms" }}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted">
            Attendance
          </h2>
          <span className="text-xs text-muted">
            {roster.length} student{roster.length === 1 ? "" : "s"} enrolled
          </span>
        </div>

        {roster.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              No students are enrolled in this class yet.
            </p>
          </Card>
        ) : (
          <form action={saveAttendance}>
            <input type="hidden" name="lessonId" value={lesson.id} />
            <Card className="p-0 overflow-hidden">
              <ul className="divide-y divide-hairline">
                {roster.map((s) => {
                  const current = s.attendanceStatus ?? "";
                  return (
                    <li key={s.id} className="px-6 py-4 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <Link
                            href={`/tutor/students/${s.id}`}
                            className="text-sm text-ink hover:underline underline-offset-4"
                          >
                            {s.firstName} {s.lastName}
                          </Link>
                          {s.yearLevel && (
                            <span className="ml-3 text-xs text-muted">
                              {s.yearLevel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ATTENDANCE_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className="cursor-pointer"
                          >
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
            </Card>
          </form>
        )}
      </section>

      <section className="rise space-y-4" style={{ animationDelay: "160ms" }}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted">
            Lesson notes
          </h2>
          <span className="text-xs text-muted">One note per student.</span>
        </div>

        {roster.length === 0 ? null : (
          <div className="space-y-5">
            {roster.map((s) => {
              const existing = notesByStudent.get(s.id);
              return (
                <Card key={s.id} className="space-y-5">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-lg text-ink">
                      {s.firstName} {s.lastName}
                    </h3>
                    {existing && (
                      <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
                        Last saved{" "}
                        {new Intl.DateTimeFormat("en-AU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(existing.createdAt)}
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

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Parent-visible — green tone, clearly separated */}
                      <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          <CardLabel className="text-emerald-900">
                            Parent-visible comment
                          </CardLabel>
                        </div>
                        <p className="text-xs text-emerald-900/80">
                          The student and their parent <strong>will see this</strong>.
                          Write what's appropriate for them to read.
                        </p>
                        <textarea
                          name="parentVisibleComment"
                          defaultValue={existing?.parentVisibleComment ?? ""}
                          rows={4}
                          className="w-full rounded-xl border border-emerald-300 bg-card p-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          placeholder="e.g. Great work today on factorisation. Keep practising the trickier worked examples this week."
                        />
                      </div>

                      {/* Internal — amber tone, clearly different */}
                      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                          <CardLabel className="text-amber-900">
                            Internal note · tutor &amp; admin only
                          </CardLabel>
                        </div>
                        <p className="text-xs text-amber-900/80">
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
