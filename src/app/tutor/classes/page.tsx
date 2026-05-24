import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { getTutorClasses, requireTutor } from "../_data";

const WEEKDAY = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function trimTime(t: string | null) {
  return t ? t.slice(0, 5) : "—";
}

export default async function TutorClassesPage() {
  const tutor = await requireTutor();
  const list = await getTutorClasses(tutor.id);

  return (
    <div className="space-y-10">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Your classes
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          {list.length} active{" "}
          <span className="font-display">classes</span>
        </h1>
      </header>

      {list.length === 0 ? (
        <Card>
          <CardLabel>No classes yet</CardLabel>
          <p className="mt-3 text-sm text-ink-soft">
            An admin needs to assign you to a class before students will appear.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-5 rise" style={{ animationDelay: "80ms" }}>
          {list.map((c) => (
            <Card key={c.id} className="space-y-4">
              <div>
                <CardLabel>{c.subjectName}{c.subjectYear ? ` · ${c.subjectYear}` : ""}</CardLabel>
                <h2 className="mt-2 text-2xl font-light text-ink">{c.name}</h2>
              </div>
              <dl className="text-sm text-ink-soft grid grid-cols-2 gap-y-2">
                <dt className="text-muted">When</dt>
                <dd className="text-right text-ink">
                  {typeof c.weekday === "number" ? WEEKDAY[c.weekday] : "—"}{" "}
                  <span className="tabular-nums">
                    {trimTime(c.startTime)}–{trimTime(c.endTime)}
                  </span>
                </dd>
                <dt className="text-muted">Where</dt>
                <dd className="text-right text-ink">
                  {c.location ?? (c.onlineLink ? "Online" : "—")}
                </dd>
                <dt className="text-muted">Enrolled</dt>
                <dd className="text-right text-ink tabular-nums">
                  {c.enrolledCount} / {c.capacity}
                </dd>
              </dl>
              <div className="flex gap-3 pt-2 border-t border-hairline/60">
                <Link
                  href="/tutor/students"
                  className="text-[11px] uppercase tracking-[0.16em] text-brand-700 hover:text-brand-600"
                >
                  Students →
                </Link>
                <Link
                  href="/tutor/homework"
                  className="text-[11px] uppercase tracking-[0.16em] text-brand-700 hover:text-brand-600"
                >
                  Homework →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
