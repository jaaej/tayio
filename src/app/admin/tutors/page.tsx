import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { Card, CardHead, CardBody, Pill, PageHeader, Empty } from "@/components/admin/ui";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { getTutorDirectory } from "@/app/admin/_lib/queries";
import { TutorBankForm } from "./_components/tutor-bank-form";

export const dynamic = "force-dynamic";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AdminTutorsPage() {
  // Owner-only: bank details are payroll PII. Reception is bounced.
  await requireUnrestrictedAdmin();
  const tutors = await getTutorDirectory();

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Team"
        title="Tutors"
        sub="Every active tutor with the subjects they teach, their schedule, and payroll details. Owner-only - reception can't see this."
        actions={
          <Link
            href="/admin/tutors/availability"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] font-bold text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Availability board
          </Link>
        }
      />

      {tutors.length === 0 ? (
        <Card>
          <CardBody>
            <Empty>No active tutors yet.</Empty>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-5">
          {tutors.map((t) => (
            <Card key={t.tutorId} className="overflow-hidden">
              <CardHead
                title={`${t.firstName} ${t.lastName}`}
                action={
                  <span className="text-[12px] text-muted">
                    {[t.email, t.phone].filter(Boolean).join(" · ")}
                  </span>
                }
              />
              <CardBody className="space-y-5">
                {/* Subjects */}
                <div>
                  <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-muted mb-2">
                    Teaches
                  </div>
                  {t.subjects.length === 0 ? (
                    <p className="text-[13px] text-muted">
                      No classes assigned.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {t.subjects.map((s) => (
                        <Pill key={s} tone="brand">
                          {s}
                        </Pill>
                      ))}
                    </div>
                  )}
                </div>

                {/* Schedule */}
                <div>
                  <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-muted mb-2">
                    Class schedule
                  </div>
                  {t.classes.length === 0 ? (
                    <p className="text-[13px] text-muted">No classes.</p>
                  ) : (
                    <ul className="divide-y divide-line rounded-[12px] border border-line overflow-hidden">
                      {t.classes.map((c) => (
                        <li
                          key={c.classId}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="text-[13px] font-bold text-ink truncate">
                              {c.className}
                            </div>
                            <div className="text-[11px] text-muted truncate">
                              {c.subjectName}
                            </div>
                          </div>
                          <div className="text-[12px] font-semibold text-ink-soft tabular-nums shrink-0">
                            {typeof c.weekday === "number" && c.startTime
                              ? `${WEEKDAY[c.weekday]} ${formatTime(c.startTime)}${
                                  c.endTime ? `–${formatTime(c.endTime)}` : ""
                                }`
                              : "No slot"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Bank / payroll details */}
                <div>
                  <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-muted mb-2">
                    Payroll details
                  </div>
                  <TutorBankForm tutorId={t.tutorId} initial={t.bank} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
