import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  Avatar,
  Empty,
  GlassPanel,
  PageHeader,
  buttonVariants,
} from "@/components/admin/ui";
import { UrlLabelledSelect } from "@/components/admin/ui/labelled-select";
import { getTutorWeeklyAvailabilityBoard } from "@/app/admin/_lib/queries";
import type { UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { isUnrestrictedAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { boardSubjects, freeTutorCount, slotsForSubject } from "./_lib/board";
import { TutorAvailabilityEditor } from "./_components/availability-editor";

export const dynamic = "force-dynamic";

// Column order: Mon → Sun. Values are JS getDay() codes (0 = Sun … 6 = Sat),
// matching how weekday is stored + expanded in src/lib/availability.ts.
const DAYS: Array<{ code: number; label: string }> = [
  { code: 1, label: "Mon" },
  { code: 2, label: "Tue" },
  { code: 3, label: "Wed" },
  { code: 4, label: "Thu" },
  { code: 5, label: "Fri" },
  { code: 6, label: "Sat" },
  { code: 0, label: "Sun" },
];

export default async function AdminTutorAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const user = await requireRole("admin");
  // The tutor directory holds payroll details, so only owners get the link.
  const isOwner = isUnrestrictedAdmin(
    user.app_metadata?.role as UserRole | undefined,
  );
  const [tutors, params] = await Promise.all([
    getTutorWeeklyAvailabilityBoard(),
    searchParams,
  ]);

  const subjectOptions = boardSubjects(tutors);
  const subjectId = subjectOptions.some((s) => s.id === params.subject)
    ? (params.subject ?? "")
    : "";
  // The board can be narrowed to one subject; the editors below always manage
  // the tutor's full set of slots.
  const board = tutors.map((tutor) => ({
    ...tutor,
    slots: slotsForSubject(tutor.slots, subjectId),
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tutor availability"
        sub="Recurring weekly slots"
        actions={
          isOwner && (
            <Link
              href="/admin/tutors"
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              All tutors
            </Link>
          )
        }
      />

      <GlassPanel
        title="Weekly availability"
        titleId="availability-week-h"
        action={
          subjectOptions.length > 0 && (
            <UrlLabelledSelect
              label="Subject"
              param="subject"
              options={[
                { value: "", label: "Any" },
                ...subjectOptions.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          )
        }
      >
        {board.length === 0 ? (
          <Empty>No active tutors on record.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-[13px]">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 w-[170px] bg-surface px-4 py-3 text-[12px] font-extrabold text-muted"
                  >
                    Tutor
                  </th>
                  {DAYS.map((day) => {
                    const free = freeTutorCount(board, day.code);
                    return (
                      <th
                        scope="col"
                        key={day.code}
                        className="border-l border-line px-2 py-3 align-bottom"
                      >
                        <span className="flex flex-col gap-0.5">
                          <span className="text-[12px] font-extrabold text-ink">
                            {day.label}
                          </span>
                          <span
                            className={cn(
                              "text-[11px] font-bold tabular-nums",
                              free === 0 ? "text-bad" : "text-good",
                            )}
                          >
                            {free} free
                          </span>
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {board.map((tutor) => {
                  const name = `${tutor.firstName} ${tutor.lastName}`.trim();
                  return (
                    <tr key={tutor.tutorId} className="border-t border-line">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-surface px-4 py-3 text-left align-top"
                      >
                        <span className="flex items-center gap-2">
                          <Avatar name={name} size={28} tone="brand" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-bold text-ink">
                              {name}
                            </span>
                            {tutor.slots.length === 0 && (
                              <span className="block text-[11px] font-semibold text-muted">
                                {subjectId ? "None for this subject" : "No availability set"}
                              </span>
                            )}
                          </span>
                        </span>
                      </th>
                      {DAYS.map((day) => {
                        const slots = tutor.slots
                          .filter((s) => s.weekday === day.code)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime));
                        return (
                          <td
                            key={day.code}
                            className="border-l border-line p-2 align-top"
                          >
                            {slots.length === 0 ? (
                              <span
                                className="font-bold text-line-strong"
                                aria-label="No availability"
                              >
                                -
                              </span>
                            ) : (
                              <span className="flex flex-col gap-1">
                                {slots.map((s, i) => (
                                  <span
                                    key={i}
                                    className="flex flex-col gap-px rounded-[8px] bg-info-bg px-[7px] py-[5px] text-info"
                                  >
                                    <span className="text-[12px] font-extrabold tabular-nums">
                                      {formatTime(s.startTime)} - {formatTime(s.endTime)}
                                    </span>
                                    <span className="text-[11px] font-semibold">
                                      {s.subjectName ?? "Any subject"}
                                    </span>
                                  </span>
                                ))}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      {tutors.length > 0 && (
        <GlassPanel
          title="Manage availability"
          titleId="availability-manage-h"
          bodyClassName="p-2"
        >
          <ul className="flex flex-col gap-1">
            {tutors.map((tutor) => {
              const count = tutor.slots.length;
              return (
                <li key={tutor.tutorId}>
                  <details className="group rounded-[14px] open:bg-surface-2">
                    <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-[12px] px-3.5 py-3 transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 truncate text-[14px] font-bold text-ink group-open:font-extrabold">
                        {tutor.firstName} {tutor.lastName}
                      </span>
                      <span className="shrink-0 text-[12px] text-muted tabular-nums">
                        {count === 1 ? "1 slot" : `${count} slots`}
                      </span>
                      <span
                        aria-hidden
                        className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-[9px] border border-line-strong bg-surface px-3 text-[12px] font-bold text-ink"
                      >
                        <span className="group-open:hidden">Edit</span>
                        <span className="hidden group-open:inline">Close</span>
                        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-150 group-open:rotate-180" />
                      </span>
                    </summary>
                    <div className="px-3.5 pb-3.5">
                      <TutorAvailabilityEditor
                        tutorId={tutor.tutorId}
                        subjects={tutor.subjects}
                        slots={tutor.slots}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </GlassPanel>
      )}
    </div>
  );
}
