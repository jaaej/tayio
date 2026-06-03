import Link from "next/link";
import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { formatDateShort, relativeTime } from "@/lib/format";
import { getRecentLessonNotes, requireTutor } from "../_data";

export default async function TutorNotesPage() {
  const tutor = await requireTutor();
  const notes = await getRecentLessonNotes(tutor.id);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Lesson notes"
        title="Your most recent notes"
        sub="Notes are written from the lesson page after each class."
      />

      {notes.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-bold">
              No notes yet
            </div>
            <p className="mt-2 text-sm text-muted">
              Open a lesson from{" "}
              <Link
                href="/tutor"
                className="text-brand-600 font-bold hover:text-brand-700"
              >
                Today
              </Link>{" "}
              or your{" "}
              <Link
                href="/tutor/classes"
                className="text-brand-600 font-bold hover:text-brand-700"
              >
                class list
              </Link>{" "}
              to write your first one.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3.5">
          {notes.map((n) => (
            <Card key={n.id}>
              <CardBody className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/tutor/students/${n.studentId}`}
                      className="text-[13px] font-bold text-ink hover:text-brand-700"
                    >
                      {n.studentFirstName} {n.studentLastName}
                    </Link>
                    <span className="text-muted text-[12px]">
                      {" "}
                      · {n.className}
                      {n.topicCovered ? ` · ${n.topicCovered}` : ""}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted tabular-nums shrink-0">
                    {formatDateShort(n.lessonDate)}{" "}
                    <span className="text-muted-2">
                      · {relativeTime(new Date(n.createdAt))}
                    </span>
                  </div>
                </div>
                {n.parentVisibleComment && (
                  <div className="rounded-[12px] border border-good/40 bg-good-bg p-3">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-good font-bold">
                      Parent will see this
                    </div>
                    <p className="mt-1.5 text-[13px] text-ink whitespace-pre-wrap leading-snug">
                      {n.parentVisibleComment}
                    </p>
                  </div>
                )}
                {n.internalNote && (
                  <div className="rounded-[12px] border border-warn/40 bg-warn-bg p-3">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-warn font-bold">
                      Only you and admin see this
                    </div>
                    <p className="mt-1.5 text-[13px] text-ink whitespace-pre-wrap leading-snug">
                      {n.internalNote}
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
