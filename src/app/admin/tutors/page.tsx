import Link from "next/link";
import { CalendarCheck, ChevronDown } from "lucide-react";
import { Card, CardBody, Pill, PageHeader, Empty } from "@/components/admin/ui";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { getTutorDirectory } from "@/app/admin/_lib/queries";
import { TutorBankForm } from "./_components/tutor-bank-form";

export const dynamic = "force-dynamic";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Subject pills shown on a collapsed row before the rest roll up into "+n". */
const MAX_VISIBLE_SUBJECTS = 4;

const SECTION_LABEL =
  "text-[11px] uppercase tracking-[0.12em] font-bold text-muted mb-2";

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
        sub="Owner-only - reception can't see this."
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
        <Card>
          <div className="divide-y divide-line">
            {tutors.map((t) => {
              const visibleSubjects = t.subjects.slice(0, MAX_VISIBLE_SUBJECTS);
              const hiddenSubjects = t.subjects.slice(MAX_VISIBLE_SUBJECTS);
              const contact = [t.email, t.phone].filter(Boolean).join(" · ");

              return (
                <details key={t.tutorId} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                        <span className="text-[14px] font-bold text-ink">
                          {t.firstName} {t.lastName}
                        </span>
                        {t.subjects.length === 0 ? (
                          <span className="text-[12px] text-muted">
                            No classes
                          </span>
                        ) : (
                          <span className="flex flex-wrap items-center gap-1.5">
                            {visibleSubjects.map((s) => (
                              <Pill key={s} tone="brand">
                                {s}
                              </Pill>
                            ))}
                            {hiddenSubjects.length > 0 && (
                              // Full list is one press away in the expanded schedule.
                              <span title={hiddenSubjects.join(", ")}>
                                <Pill tone="default">
                                  +{hiddenSubjects.length}
                                </Pill>
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {contact && (
                        <div className="truncate text-[12px] text-muted">
                          {contact}
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>

                  <div className="space-y-5 border-t border-line px-5 pb-5 pt-4">
                    {/* Schedule */}
                    <div>
                      <div className={SECTION_LABEL}>Class schedule</div>
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
                                      c.endTime
                                        ? `–${formatTime(c.endTime)}`
                                        : ""
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
                      <div className={SECTION_LABEL}>Payroll details</div>
                      <TutorBankForm tutorId={t.tutorId} initial={t.bank} />
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
