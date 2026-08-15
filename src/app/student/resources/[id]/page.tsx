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

/**
 * Turn a hosted video URL into an embeddable player src for the common hosts
 * (YouTube, Vimeo). Returns null for anything we can't safely embed, so the
 * caller falls back to a plain "Watch recording" link.
 */
function videoEmbedSrc(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (u.pathname.startsWith("/embed/"))
      return `https://www.youtube-nocookie.com${u.pathname}`;
  }
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

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

  const embedSrc = lesson.recordingUrl
    ? videoEmbedSrc(lesson.recordingUrl)
    : null;

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

      {lesson.recordingUrl && (
        <section className="rise" style={{ animationDelay: "90ms" }}>
          <CardLabel>Lesson recording</CardLabel>
          {embedSrc ? (
            <div className="mt-3 aspect-video w-full overflow-hidden rounded-2xl border border-hairline/60 bg-black">
              <iframe
                src={embedSrc}
                title="Lesson recording"
                className="h-full w-full"
                allow="accelerated-media; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <Card className="mt-3">
              <a
                href={lesson.recordingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                ▶ Watch recording ↗
              </a>
            </Card>
          )}
        </section>
      )}

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
