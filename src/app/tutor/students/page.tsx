import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getTutorStudents, requireTutor } from "../_data";

export default async function TutorStudentsPage() {
  const tutor = await requireTutor();
  const students = await getTutorStudents(tutor.id);

  return (
    <div className="space-y-6">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Your roster
        </div>
        <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          {students.length}{" "}
          {students.length === 1 ? "student" : "students"}
        </h1>
        <p className="mt-3 text-sm text-ink-soft max-w-xl">
          Only students enrolled in classes you teach.
        </p>
      </header>

      {students.length === 0 ? (
        <Card>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">
            No students yet
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            Students will appear here once they're enrolled in one of your
            classes.
          </p>
        </Card>
      ) : (
        <Card
          className="p-0 overflow-hidden rise"
          style={{ animationDelay: "80ms" }}
        >
          <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100">
            <div className="text-xl font-medium text-ink">All Students</div>
          </div>
          <ul className="divide-y divide-hairline/60">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/tutor/students/${s.id}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-brand-50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-navy-800 text-white flex items-center justify-center text-sm font-medium shrink-0">
                    {s.firstName.charAt(0)}
                    {s.lastName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-ink truncate">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="text-sm text-muted mt-0.5 truncate">
                      {s.yearLevel || s.email}
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-brand-700 shrink-0">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
