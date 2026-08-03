import Link from "next/link";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { formatTime } from "@/lib/format";
import { getTutorStudentsByClass, requireTutor } from "../_data";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TutorStudentsPage() {
  const tutor = await requireTutor();
  const { classes, totalStudents } = await getTutorStudentsByClass(tutor.id);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Your roster"
        title="Students"
        sub={`${totalStudents} student${totalStudents === 1 ? "" : "s"} across ${classes.length} class${classes.length === 1 ? "" : "es"} you teach.`}
      />

      {classes.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-bold">
              No classes yet
            </div>
            <p className="mt-2 text-sm text-muted">
              Students will appear here once you're assigned a class with
              enrolled students.
            </p>
          </CardBody>
        </Card>
      ) : (
        classes.map((c) => {
          const schedule =
            typeof c.weekday === "number" && c.startTime
              ? `${WEEKDAY[c.weekday]} ${formatTime(c.startTime)}`
              : null;
          return (
            <Card key={c.classId} className="overflow-hidden">
              <CardHead
                title={
                  <span className="flex items-baseline gap-2">
                    {c.className}
                    <span className="text-[11px] font-semibold text-muted">
                      {c.subjectName}
                      {schedule ? ` · ${schedule}` : ""}
                    </span>
                  </span>
                }
                action={`${c.students.length} student${c.students.length === 1 ? "" : "s"}`}
              />
              {c.students.length === 0 ? (
                <CardBody>
                  <p className="text-sm text-muted">
                    No students enrolled in this class yet.
                  </p>
                </CardBody>
              ) : (
                <ul className="divide-y divide-line">
                  {c.students.map((s) => (
                    <li key={`${c.classId}-${s.id}`}>
                      <Link
                        href={`/tutor/students/${s.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                      >
                        <div className="h-9 w-9 rounded-full bg-brand-500 text-white grid place-items-center text-[12px] font-bold shrink-0">
                          {s.firstName.charAt(0)}
                          {s.lastName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-ink truncate">
                            {s.firstName} {s.lastName}
                          </div>
                          {s.yearLevel && (
                            <div className="text-[11px] text-muted mt-0.5 truncate">
                              {s.yearLevel}
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600 shrink-0">
                          Open →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
