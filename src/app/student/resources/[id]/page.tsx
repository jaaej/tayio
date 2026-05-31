import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardLabel } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { StatusBadge } from "../../_components/badge";
import {
  formatDateLong,
  formatTime,
  LESSON_STATUS_LABEL,
  LESSON_STATUS_STYLE,
} from "../../_lib/format";
import { getLessonRecap } from "../../_lib/queries";

export default async function LessonRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("student");
  const lesson = await getLessonRecap(user.id, id);
  if (!lesson) notFound();

  const hasAnyNotes =
    !!lesson.topicCovered ||
    !!lesson.keyConcepts ||
    !!lesson.strengths ||
    !!lesson.struggles ||
    !!lesson.nextLessonFocus ||
    !!lesson.parentVisibleComment;

  return (
    <div className="space-y-10">
      <div className="rise">
        <Link
          href="/student/resources"
          className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
        >
          ← All Resources
        </Link>
      </div>

      <header className="rise" style={{ animationDelay: "60ms" }}>
        <CardLabel>{lesson.className}</CardLabel>
        <h1 className="mt-2 text-3xl lg:text-4xl font-light tracking-tight text-ink">
          {lesson.subjectName}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
          <span>{formatDateLong(lesson.date)}</span>
          <span>
            {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
          </span>
          <span>
            with {lesson.tutorFirstName} {lesson.tutorLastName}
          </span>
          <StatusBadge
            label={LESSON_STATUS_LABEL[lesson.status] ?? lesson.status}
            className={LESSON_STATUS_STYLE[lesson.status]}
          />
        </div>
      </header>

      {!hasAnyNotes ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            Your tutor hasn't written a recap for this lesson yet. Check back later.
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {lesson.topicCovered && (
            <RecapBlock label="Topic covered" body={lesson.topicCovered} />
          )}
          {lesson.keyConcepts && (
            <RecapBlock label="Key concepts" body={lesson.keyConcepts} />
          )}
          {lesson.strengths && (
            <RecapBlock label="What went well" body={lesson.strengths} />
          )}
          {lesson.struggles && (
            <RecapBlock
              label="What to revise"
              body={lesson.struggles}
            />
          )}
          {lesson.nextLessonFocus && (
            <RecapBlock
              label="Next lesson focus"
              body={lesson.nextLessonFocus}
            />
          )}
          {lesson.parentVisibleComment && (
            <RecapBlock
              label="From your tutor"
              body={lesson.parentVisibleComment}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RecapBlock({ label, body }: { label: string; body: string }) {
  return (
    <section className="rise">
      <CardLabel>{label}</CardLabel>
      <Card className="mt-3">
        <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
          {body}
        </div>
      </Card>
    </section>
  );
}
