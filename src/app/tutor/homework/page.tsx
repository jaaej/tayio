import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createHomework } from "../_actions";
import { getTutorClasses, getTutorHomework, requireTutor } from "../_data";

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function TutorHomeworkPage() {
  const tutor = await requireTutor();
  const [items, tutorClasses] = await Promise.all([
    getTutorHomework(tutor.id),
    getTutorClasses(tutor.id),
  ]);

  return (
    <div className="space-y-12">
      <header className="rise space-y-2">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Homework
        </div>
        <h1 className="text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Assign &amp;{" "}
          <span className="font-display">mark work</span>.
        </h1>
      </header>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card className="space-y-5">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted">
            New homework
          </h2>
          <form
            action={createHomework}
            className="space-y-5"
            encType="multipart/form-data"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required placeholder="e.g. Worksheet 3 — quadratics" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due</Label>
                <Input id="dueDate" name="dueDate" type="datetime-local" required />
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
                  Uploads land in the <code className="text-ink">homework-attachments</code>{" "}
                  storage bucket. If the bucket isn't provisioned the homework
                  is still saved without an attachment.
                </p>
              </div>
              <label className="flex items-center gap-2 md:col-span-2 text-sm text-ink-soft">
                <input type="checkbox" name="allowResubmission" className="accent-ink" />
                Allow resubmission
              </label>
            </div>
            <div className="flex justify-end pt-2 border-t border-hairline/60">
              <Button type="submit">Create homework</Button>
            </div>
          </form>
        </Card>
      </section>

      <section className="rise space-y-4" style={{ animationDelay: "160ms" }}>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Existing homework
        </h2>
        {items.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              You haven't assigned any homework yet.
            </p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <ul className="divide-y divide-hairline">
              {items.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/tutor/homework/${h.id}`}
                    className="flex items-center gap-6 px-6 py-5 hover:bg-brand-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-ink">{h.title}</div>
                      <div className="text-xs text-muted mt-0.5">
                        {h.className ?? "Individual"} · Due{" "}
                        {dateFmt.format(new Date(h.dueDate))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-ink tabular-nums">
                        {h.marked}/{h.total} marked
                      </div>
                      {h.toMark > 0 && (
                        <div className="text-[11px] uppercase tracking-[0.14em] text-amber-700">
                          {h.toMark} to review
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-brand-700">
                      Open →
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
