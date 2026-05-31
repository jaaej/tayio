import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDateShort, relativeTime } from "@/lib/format";
import { getRecentLessonNotes, requireTutor } from "../_data";

export default async function TutorNotesPage() {
  const tutor = await requireTutor();
  const notes = await getRecentLessonNotes(tutor.id);

  return (
    <div className="space-y-6">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Lesson Notes
        </div>
        <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Your Most Recent Notes
        </h1>
        <p className="mt-3 text-sm text-ink-soft max-w-xl">
          Notes are written from the lesson page after each class.
        </p>
      </header>

      {notes.length === 0 ? (
        <Card>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">
            No notes yet
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            Open a lesson from{" "}
            <Link href="/tutor" className="text-brand-700 hover:underline">
              Today
            </Link>{" "}
            or your{" "}
            <Link
              href="/tutor/classes"
              className="text-brand-700 hover:underline"
            >
              class list
            </Link>{" "}
            to write your first one.
          </p>
        </Card>
      ) : (
        <div className="space-y-4 rise" style={{ animationDelay: "80ms" }}>
          {notes.map((n) => (
            <Card key={n.id} className="space-y-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/tutor/students/${n.studentId}`}
                    className="text-base text-ink hover:underline underline-offset-4"
                  >
                    {n.studentFirstName} {n.studentLastName}
                  </Link>
                  <span className="text-muted text-sm">
                    {" "}
                    · {n.className}
                    {n.topicCovered ? ` · ${n.topicCovered}` : ""}
                  </span>
                </div>
                <div className="text-xs text-muted tabular-nums shrink-0">
                  {formatDateShort(n.lessonDate)}{" "}
                  <span className="text-muted/60">
                    · {relativeTime(new Date(n.createdAt))}
                  </span>
                </div>
              </div>
              {n.parentVisibleComment && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-800 font-medium">
                    Parent will see this
                  </div>
                  <p className="mt-2 text-sm text-ink whitespace-pre-wrap leading-relaxed">
                    {n.parentVisibleComment}
                  </p>
                </div>
              )}
              {n.internalNote && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-amber-800 font-medium">
                    Only you and admin see this
                  </div>
                  <p className="mt-2 text-sm text-ink whitespace-pre-wrap leading-relaxed">
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
