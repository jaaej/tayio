import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { getTutorStudents, requireTutor } from "../_data";

export default async function TutorStudentsPage() {
  const tutor = await requireTutor();
  const students = await getTutorStudents(tutor.id);

  return (
    <div className="space-y-10">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Your students
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          {students.length}{" "}
          <span className="font-display italic">
            {students.length === 1 ? "student" : "students"}
          </span>
        </h1>
        <p className="mt-3 text-sm text-ink-soft max-w-xl">
          Only students enrolled in classes you teach are shown.
        </p>
      </header>

      {students.length === 0 ? (
        <Card>
          <CardLabel>No students yet</CardLabel>
          <p className="mt-3 text-sm text-ink-soft">
            Students will appear here once they're enrolled into one of your
            classes.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "80ms" }}>
          <ul className="divide-y divide-hairline">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/tutor/students/${s.id}`}
                  className="flex items-center gap-6 px-6 py-4 hover:bg-brand-50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-navy-800 text-white flex items-center justify-center text-sm">
                    {s.firstName.charAt(0)}
                    {s.lastName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="text-ink">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {[s.yearLevel, s.school].filter(Boolean).join(" · ") ||
                        s.email}
                    </div>
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
    </div>
  );
}
