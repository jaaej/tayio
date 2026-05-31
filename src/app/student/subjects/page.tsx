import { requireRole } from "@/lib/auth";
import { SubjectCard } from "@/components/data/subject-card";
import { Card } from "@/components/ui/card";
import { getStudentSubjects } from "../_lib/queries";

const ACCENT_PALETTE = [
  "var(--periwinkle-500)",
  "#6b82c8",
  "#7fa0d8",
  "#a8b8e8",
  "#5e7bc7",
  "#8a9dd9",
];
function colorForSubject(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
}

export default async function StudentSubjectsIndex() {
  const user = await requireRole("student");
  const subjects = await getStudentSubjects(user.id);

  return (
    <div className="space-y-8">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          My subjects
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          {subjects.length} subject{subjects.length === 1 ? "" : "s"}.
        </h1>
        <p className="mt-2 text-ink-soft">
          Tap a subject to see class materials, lessons, homework, and progress.
        </p>
      </header>

      {subjects.length === 0 ? (
        <Card>
          <div className="text-sm text-ink-soft">
            You're not enrolled in any classes yet.
          </div>
        </Card>
      ) : (
        <div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 rise"
          style={{ animationDelay: "60ms" }}
        >
          {subjects.map((s) => (
            <SubjectCard
              key={s.classId}
              href={`/student/subjects/${s.subjectId}`}
              subject={s.subjectName}
              meta={`${s.tutorFirstName} ${s.tutorLastName} · ${s.yearLevel ?? ""}`}
              accent={colorForSubject(s.subjectName)}
              badge={
                s.dueHomeworkCount > 0
                  ? { label: `${s.dueHomeworkCount} due`, tone: "warn" }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
