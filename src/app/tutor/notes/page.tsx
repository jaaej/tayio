import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { getRecentLessonNotes, requireTutor } from "../_data";

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
});

export default async function TutorNotesPage() {
  const tutor = await requireTutor();
  const notes = await getRecentLessonNotes(tutor.id);

  return (
    <div className="space-y-10">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Lesson notes
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Your most recent{" "}
          <span className="font-display italic">notes</span>
        </h1>
        <p className="mt-3 text-sm text-ink-soft max-w-xl">
          Notes are written from the lesson page after each class.
        </p>
      </header>

      {notes.length === 0 ? (
        <Card>
          <CardLabel>No notes yet</CardLabel>
          <p className="mt-3 text-sm text-ink-soft">
            Open a lesson from{" "}
            <Link href="/tutor" className="text-brand-700 underline-offset-4 hover:underline">
              Today
            </Link>{" "}
            or your{" "}
            <Link href="/tutor/classes" className="text-brand-700 underline-offset-4 hover:underline">
              class list
            </Link>{" "}
            to write your first one.
          </p>
        </Card>
      ) : (
        <div className="space-y-4 rise" style={{ animationDelay: "80ms" }}>
          {notes.map((n) => (
            <Card key={n.id} className="space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <Link
                    href={`/tutor/students/${n.studentId}`}
                    className="text-sm text-ink hover:underline underline-offset-4"
                  >
                    {n.studentFirstName} {n.studentLastName}
                  </Link>
                  <span className="text-ink-soft text-sm">
                    {" "}
                    · {n.className}
                    {n.topicCovered ? ` · ${n.topicCovered}` : ""}
                  </span>
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
                    Internal
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
    </div>
  );
}
