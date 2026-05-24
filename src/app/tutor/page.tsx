import Link from "next/link";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import {
  getPendingMarkCount,
  getPendingNotesCount,
  getTodayLessons,
  requireTutor,
} from "./_data";

const dayMonth = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
});

function trimTime(t: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

export default async function TutorDashboard() {
  const tutor = await requireTutor();
  const [lessonsToday, pendingMark, pendingNotes] = await Promise.all([
    getTodayLessons(tutor.id),
    getPendingMarkCount(tutor.id),
    getPendingNotesCount(tutor.id),
  ]);

  const lessonsCount = lessonsToday.length;
  const heading =
    lessonsCount === 0
      ? "Nothing scheduled"
      : lessonsCount === 1
        ? "One class"
        : `${lessonsCount} classes`;

  return (
    <div className="space-y-12">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Today · {dayMonth.format(new Date())}
        </div>
        <h1 className="mt-2 text-5xl lg:text-6xl font-light tracking-tight text-ink">
          {heading} <span className="font-display italic">to teach</span>.
        </h1>
      </header>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card className="p-0 overflow-hidden">
          {lessonsToday.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-sm text-ink-soft">
                No lessons on the books for today.
              </div>
              <div className="mt-2 text-xs text-muted">
                Check your{" "}
                <Link href="/tutor/classes" className="underline-offset-4 hover:underline text-brand-700">
                  class list
                </Link>{" "}
                for upcoming sessions.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {lessonsToday.map((l) => (
                <Link
                  key={l.id}
                  href={`/tutor/lessons/${l.id}`}
                  className="flex items-baseline gap-8 px-6 py-5 hover:bg-brand-50 transition-colors"
                >
                  <div className="w-24 text-sm tabular-nums text-ink">
                    {trimTime(l.startTime)} – {trimTime(l.endTime)}
                  </div>
                  <div className="flex-1">
                    <div className="text-base text-ink">{l.className}</div>
                    <div className="text-xs text-muted mt-1">
                      {l.subjectName}
                      {l.location ? ` · ${l.location}` : ""}
                      {l.onlineLink ? " · Online" : ""}
                    </div>
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-brand-700">
                    Open →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section
        className="grid lg:grid-cols-3 gap-5 rise"
        style={{ animationDelay: "160ms" }}
      >
        <Link href="/tutor/homework" className="block">
          <Card className="h-full hover:border-brand-400 transition-colors">
            <CardLabel>To mark</CardLabel>
            <CardTitle>
              {pendingMark} submission{pendingMark === 1 ? "" : "s"}
            </CardTitle>
            <div className="mt-4 text-xs text-muted">
              {pendingMark === 0
                ? "All caught up."
                : "Awaiting your feedback."}
            </div>
          </Card>
        </Link>
        <Link href="/tutor/notes" className="block">
          <Card className="h-full hover:border-brand-400 transition-colors">
            <CardLabel>Notes pending</CardLabel>
            <CardTitle>
              {pendingNotes} lesson{pendingNotes === 1 ? "" : "s"}
            </CardTitle>
            <div className="mt-4 text-xs text-muted">
              {pendingNotes === 0
                ? "Every past lesson is documented."
                : "Past lessons without a note."}
            </div>
          </Card>
        </Link>
        <Link href="/tutor/students" className="block">
          <Card className="h-full hover:border-brand-400 transition-colors">
            <CardLabel>Students</CardLabel>
            <CardTitle>Your roster</CardTitle>
            <div className="mt-4 text-xs text-muted">
              Profiles, history, progress.
            </div>
          </Card>
        </Link>
      </section>
    </div>
  );
}
