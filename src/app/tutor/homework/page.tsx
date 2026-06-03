import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { Label } from "@/components/ui/input";
import { formatDueDate } from "@/lib/format";
import { db } from "@/db/client";
import { subjectWeeks, subjects } from "@/db/schema";
import { resolveCurrentTerm } from "@/lib/curriculum";
import { createHomework } from "../_actions";
import { getTutorClasses, getTutorHomework, requireTutor } from "../_data";

const INPUT_CLS =
  "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

export default async function TutorHomeworkPage() {
  const tutor = await requireTutor();
  const [items, tutorClasses, currentTerm] = await Promise.all([
    getTutorHomework(tutor.id),
    getTutorClasses(tutor.id),
    resolveCurrentTerm(),
  ]);

  const tutorSubjectIds = Array.from(
    new Set(tutorClasses.map((c) => c.subjectId)),
  );
  let availableWeeks: Array<{ id: string; label: string }> = [];
  if (currentTerm && tutorSubjectIds.length > 0) {
    const rows = await db
      .select({
        id: subjectWeeks.id,
        weekNumber: subjectWeeks.weekNumber,
        title: subjectWeeks.title,
        subjectName: subjects.name,
      })
      .from(subjectWeeks)
      .innerJoin(subjects, eq(subjects.id, subjectWeeks.subjectId))
      .where(
        and(
          eq(subjectWeeks.termId, currentTerm.id),
          inArray(subjectWeeks.subjectId, tutorSubjectIds),
        ),
      )
      .orderBy(asc(subjects.name), asc(subjectWeeks.weekNumber));
    availableWeeks = rows.map((r) => ({
      id: r.id,
      label: `${r.subjectName} · Week ${r.weekNumber} — ${r.title}`,
    }));
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Homework"
        title="Assign &amp; mark work"
        sub={`${items.length} item${items.length === 1 ? "" : "s"} across your classes`}
      />

      <Card className="overflow-hidden">
        <CardHead title="New homework" />
        <form
          action={createHomework}
          className="p-4 space-y-4"
          encType="multipart/form-data"
        >
          <div className="grid md:grid-cols-2 gap-3.5">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <input
                id="title"
                name="title"
                required
                placeholder="e.g. Worksheet 3 — quadratics"
                className={INPUT_CLS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due</Label>
              <input
                id="dueDate"
                name="dueDate"
                type="datetime-local"
                required
                className={INPUT_CLS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="classId">Assign to class</Label>
              <select
                id="classId"
                name="classId"
                defaultValue=""
                className={INPUT_CLS}
              >
                <option value="">Select a class…</option>
                {tutorClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.enrolledCount} students)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="weekId">Curriculum week (optional)</Label>
              <select
                id="weekId"
                name="weekId"
                defaultValue=""
                className={INPUT_CLS}
              >
                <option value="">— Not tagged to a week —</option>
                {availableWeeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Briefly describe what to do…"
                className={`${INPUT_CLS} h-auto py-2`}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="attachment">Attachment (PDF / image)</Label>
              <input
                id="attachment"
                name="attachment"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                className="block w-full text-[13px] text-ink-soft file:mr-4 file:rounded-full file:border-0 file:bg-brand-600 file:px-3.5 file:py-1.5 file:text-[12px] file:font-bold file:text-white hover:file:bg-brand-700 cursor-pointer"
              />
              <p className="text-[11px] text-muted">
                Uploads land in the{" "}
                <code className="text-ink">homework-attachments</code> storage
                bucket. If not provisioned, homework saves without attachment.
              </p>
            </div>
            <label className="flex items-center gap-2 md:col-span-2 text-[13px] text-ink-soft">
              <input
                type="checkbox"
                name="allowResubmission"
                className="accent-brand-600"
              />
              Allow resubmission
            </label>
          </div>
          <div className="flex justify-end pt-3 border-t border-line">
            <button
              type="submit"
              className="rounded-full bg-brand-600 text-white px-4 py-2 text-[13px] font-bold hover:bg-brand-700 transition-colors"
            >
              Create homework
            </button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <CardHead
          title="Existing homework"
          action={`${items.length} item${items.length === 1 ? "" : "s"}`}
        />
        <CardBody tight>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              You haven't assigned any homework yet.
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/tutor/homework/${h.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-ink truncate">
                        {h.title}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 truncate">
                        {h.className ?? "Individual"} · due{" "}
                        {formatDueDate(new Date(h.dueDate))}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      {h.toMark > 0 && (
                        <Pill tone="warn">{h.toMark} to review</Pill>
                      )}
                      <span className="text-[11px] text-muted tabular-nums">
                        {h.marked}/{h.total} marked
                      </span>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600 shrink-0">
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
