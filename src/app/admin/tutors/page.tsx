import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import {
  Avatar,
  Empty,
  GlassPanel,
  PageHeader,
  buttonVariants,
} from "@/components/admin/ui";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import { getTutorDirectory } from "@/app/admin/_lib/queries";
import { TutorBankForm } from "./_components/tutor-bank-form";

export const dynamic = "force-dynamic";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Subject chips shown on a collapsed row before the rest roll up into "+n". */
const MAX_VISIBLE_SUBJECTS = 4;

const CHIP =
  "inline-flex h-[26px] items-center rounded-[8px] bg-surface-3 px-2.5 text-[12px] font-semibold text-ink";
const CARD_LABEL = "text-[12px] font-extrabold text-muted";

export default async function AdminTutorsPage() {
  // Owner-only: bank details are payroll PII. Reception is bounced.
  await requireUnrestrictedAdmin();
  const tutors = await getTutorDirectory();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            Tutors
            <span className="inline-flex h-[22px] items-center rounded-full bg-surface px-2 text-[11px] font-extrabold uppercase tracking-[0.04em] text-ink">
              Owner only
            </span>
          </span>
        }
        actions={
          <Link
            href="/admin/tutors/availability"
            className={buttonVariants({ variant: "glass", size: "lg" })}
          >
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Availability board
          </Link>
        }
      />

      <GlassPanel
        title="Active tutors"
        titleId="tutors-h"
        meta={tutors.length > 0 ? tutors.length : undefined}
        bodyClassName={tutors.length > 0 ? "p-1.5" : undefined}
      >
        {tutors.length === 0 ? (
          <Empty>No active tutors yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {tutors.map((t) => {
              const name = `${t.firstName} ${t.lastName}`.trim();
              const visibleSubjects = t.subjects.slice(0, MAX_VISIBLE_SUBJECTS);
              const hiddenSubjects = t.subjects.slice(MAX_VISIBLE_SUBJECTS);
              const contact = [t.email, t.phone].filter(Boolean).join(" · ");

              return (
                <li key={t.tutorId}>
                  <details className="group rounded-[12px] open:bg-surface-2">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 rounded-[12px] p-3 transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 [&::-webkit-details-marker]:hidden">
                      <Avatar name={name} size={38} tone="brand" />
                      <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                        <span className="text-[14px] font-extrabold text-ink">{name}</span>
                        {contact && (
                          <span className="truncate text-[12px] text-muted">{contact}</span>
                        )}
                      </span>
                      <span className="flex flex-[2_1_260px] flex-wrap gap-1.5">
                        {t.subjects.length === 0 ? (
                          <span className="text-[12px] text-muted">No classes</span>
                        ) : (
                          <>
                            {visibleSubjects.map((s) => (
                              <span key={s} className={CHIP}>
                                {s}
                              </span>
                            ))}
                            {hiddenSubjects.length > 0 && (
                              // Full list is one press away in the expanded schedule.
                              <span className={CHIP} title={hiddenSubjects.join(", ")}>
                                +{hiddenSubjects.length}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                      <span
                        aria-hidden
                        className="ml-auto inline-flex h-[34px] items-center rounded-[10px] border border-line-strong bg-surface px-3 text-[12px] font-bold text-ink"
                      >
                        <span className="group-open:hidden">Details</span>
                        <span className="hidden group-open:inline">Close</span>
                      </span>
                    </summary>

                    <div className="flex flex-wrap gap-3 px-3 pb-3">
                      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2 rounded-[12px] bg-surface p-3.5">
                        <h3 className={CARD_LABEL}>Class schedule</h3>
                        {t.classes.length === 0 ? (
                          <p className="text-[13px] text-muted">No classes.</p>
                        ) : (
                          <ul>
                            {t.classes.map((c) => (
                              <li
                                key={c.classId}
                                className="flex justify-between gap-2.5 border-t border-line py-2 text-[13px]"
                              >
                                <span className="min-w-0 truncate font-bold text-ink">
                                  {classDisplayName(c.subjectName, c.className)}
                                </span>
                                <span className="shrink-0 tabular-nums text-muted">
                                  {typeof c.weekday === "number" && c.startTime
                                    ? `${WEEKDAY[c.weekday]} ${formatTime(c.startTime)}${
                                        c.endTime ? ` - ${formatTime(c.endTime)}` : ""
                                      }`
                                    : "No slot"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5 rounded-[12px] bg-surface p-3.5">
                        <h3 className={CARD_LABEL}>Payroll details</h3>
                        <TutorBankForm tutorId={t.tutorId} initial={t.bank} />
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
