import { Card, CardHead, Pill, PageHeader, Empty } from "@/components/admin/ui";
import { getTutorWeeklyAvailabilityBoard } from "@/app/admin/_lib/queries";
import { requireRole } from "@/lib/auth";
import { formatTime } from "@/lib/format";

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

export default async function AdminTutorAvailabilityPage() {
  await requireRole("admin");
  const tutors = await getTutorWeeklyAvailabilityBoard();

  // Per-day count of how many tutors have any availability - a quick gap signal
  // reception can scan across the header row.
  const dayCounts = new Map<number, number>();
  for (const day of DAYS) {
    dayCounts.set(
      day.code,
      tutors.filter((t) => t.slots.some((s) => s.weekday === day.code)).length,
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        className="rise"
        eyebrow="Scheduling"
        title="Tutor availability"
        sub="Every tutor's standing weekly availability in one view. Scan a day column for gaps when coordinating cover. This board is read-only."
      />

      <Card className="rise">
        <CardHead
          title="Weekly availability"
          action={
            <Pill tone="default">
              {tutors.length} tutor{tutors.length === 1 ? "" : "s"}
            </Pill>
          }
        />
        {tutors.length === 0 ? (
          <Empty>No active tutors on record.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-surface px-5 py-3 text-[11px] uppercase tracking-[0.12em] font-bold text-muted-2 min-w-[180px]"
                  >
                    Tutor
                  </th>
                  {DAYS.map((day) => (
                    <th
                      scope="col"
                      key={day.code}
                      className="px-4 py-3 min-w-[124px] align-bottom"
                    >
                      <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-muted-2">
                        {day.label}
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold text-muted tabular-nums">
                        {dayCounts.get(day.code) ?? 0} free
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tutors.map((tutor) => {
                  const hasNone = tutor.slots.length === 0;
                  return (
                    <tr
                      key={tutor.tutorId}
                      className="hover:bg-surface-2 transition-colors"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-surface px-5 py-4 text-left align-top font-bold text-[14px] text-ink whitespace-nowrap"
                      >
                        {tutor.firstName} {tutor.lastName}
                        {hasNone && (
                          <div className="mt-1 text-[11px] font-semibold text-muted">
                            No availability set
                          </div>
                        )}
                      </th>
                      {DAYS.map((day) => {
                        const slots = tutor.slots.filter(
                          (s) => s.weekday === day.code,
                        );
                        return (
                          <td
                            key={day.code}
                            className="px-4 py-4 align-top"
                          >
                            {slots.length === 0 ? (
                              <span
                                className="text-[13px] text-muted-2"
                                aria-label="No availability"
                              >
                                –
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {slots.map((s, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex w-fit items-center rounded-md bg-brand-50 px-2 py-1 text-[12px] font-semibold text-brand-700 tabular-nums"
                                  >
                                    {formatTime(s.startTime)} – {formatTime(s.endTime)}
                                  </span>
                                ))}
                              </div>
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
      </Card>
    </div>
  );
}
