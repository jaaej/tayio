import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatDueDate } from "@/lib/format";
import { db } from "@/db/client";
import { classes, subjectWeeks, subjects } from "@/db/schema";
import { resolveCurrentTerm } from "@/lib/curriculum";
import { createHomework } from "../_actions";
import { getTutorClasses, getTutorHomework, requireTutor } from "../_data";

export default async function TutorHomeworkPage() {
  const tutor = await requireTutor();
  const [items, tutorClasses, currentTerm] = await Promise.all([
    getTutorHomework(tutor.id),
    getTutorClasses(tutor.id),
    resolveCurrentTerm(),
  ]);

  // Build list of available curriculum weeks across all subjects this tutor teaches in the current term.
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
    <div className="space-y-6">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Homework
        </div>
        <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Assign &amp; Mark Work
        </h1>
      </header>

      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "40ms" }}>
        <SectionHeader title="New Homework" />
        <form
          action={createHomework}
          className="p-6 space-y-5"
          encType="multipart/form-data"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="e.g. Worksheet 3 — quadratics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="datetime-local"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classId">Assign to class</Label>
              <select
                id="classId"
                name="classId"
                className="h-11 w-full rounded-xl border border-hairline/60 bg-card px-3 text-sm text-ink"
                defaultValue=""
              >
                <option value="">Select a class…</option>
                {tutorClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.enrolledCount} students)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekId">Curriculum week (optional)</Label>
              <select
                id="weekId"
                name="weekId"
                className="h-11 w-full rounded-xl border border-hairline/60 bg-card px-3 text-sm text-ink"
                defaultValue=""
              >
                <option value="">— Not tagged to a week —</option>
                {availableWeeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Briefly describe what to do…"
                className="w-full rounded-xl border border-hairline/60 bg-card p-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="attachment">Attachment (PDF / image)</Label>
              <input
                id="attachment"
                name="attachment"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-brand-700 cursor-pointer"
              />
              <p className="text-xs text-muted">
                Uploads land in the{" "}
                <code className="text-ink">homework-attachments</code> storage
                bucket. If the bucket isn't provisioned, the homework is saved
                without an attachment.
              </p>
            </div>
            <label className="flex items-center gap-2 md:col-span-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                name="allowResubmission"
                className="accent-ink"
              />
              Allow resubmission
            </label>
          </div>
          <div className="flex justify-end pt-3 border-t border-hairline/60">
            <Button type="submit">Create homework</Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "80ms" }}>
        <SectionHeader title="Existing Homework" />
        {items.length === 0 ? (
          <Empty>You haven't assigned any homework yet.</Empty>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {items.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/tutor/homework/${h.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-ink truncate">{h.title}</div>
                    <div className="text-sm text-muted mt-0.5 truncate">
                      {h.className ?? "Individual"} · due{" "}
                      {formatDueDate(new Date(h.dueDate))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-ink tabular-nums">
                      {h.marked}/{h.total} marked
                    </div>
                    {h.toMark > 0 && (
                      <div className="text-[11px] uppercase tracking-[0.16em] text-amber-700 mt-0.5">
                        {h.toMark} to review
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-brand-700 shrink-0">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
