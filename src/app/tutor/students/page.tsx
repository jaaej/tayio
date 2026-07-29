import Link from "next/link";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { TrialBadge } from "@/components/tutor/trial-badge";
import { getTutorStudents, requireTutor } from "../_data";

export default async function TutorStudentsPage() {
  const tutor = await requireTutor();
  const students = await getTutorStudents(tutor.id);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Your roster"
        title={`${students.length} ${students.length === 1 ? "student" : "students"}`}
        sub="Only students enrolled in classes you teach."
      />

      {students.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-bold">
              No students yet
            </div>
            <p className="mt-2 text-sm text-muted">
              Students will appear here once they're enrolled in one of your
              classes.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHead title="All students" action={`${students.length} total`} />
          <CardBody tight>
            <ul className="divide-y divide-line">
              {students.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/tutor/students/${s.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-full bg-brand-500 text-white grid place-items-center text-[12px] font-bold shrink-0">
                      {s.firstName.charAt(0)}
                      {s.lastName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-[13px] font-bold text-ink truncate">
                          {s.firstName} {s.lastName}
                        </div>
                        <TrialBadge
                          trialStartsAt={s.trialStartsAt}
                          trialEndsAt={s.trialEndsAt}
                          today={today}
                        />
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 truncate">
                        {s.yearLevel || s.email}
                      </div>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600 shrink-0">
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
