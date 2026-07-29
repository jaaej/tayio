import { Card, CardHead, Empty, PageHeader, Pill } from "@/components/admin/ui";
import { getTrials, type Trial } from "@/app/admin/_lib/queries";
import { deriveTrialStatus, isEndingSoon, type TrialStatus } from "@/lib/trials";
import { formatDateShort } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { TrialActions } from "./_components/trial-actions";

export const dynamic = "force-dynamic";

type RowWithStatus = Trial & { status: TrialStatus; endingSoon: boolean };

function TrialsTable({
  eyebrow,
  title,
  rows,
  emptyLabel,
}: {
  eyebrow: string;
  title: string;
  rows: RowWithStatus[];
  emptyLabel: string;
}) {
  return (
    <Card className="rise">
      <CardHead
        eyebrow={eyebrow}
        title={title}
        action={<Pill tone="default">{rows.length}</Pill>}
      />
      {rows.length === 0 ? (
        <Empty>{emptyLabel}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-2 text-[11px] uppercase tracking-[0.08em] text-muted font-bold">
                <th className="text-left px-5 py-2.5">Student</th>
                <th className="text-left px-5 py-2.5">Class</th>
                <th className="text-left px-5 py-2.5">Tutor</th>
                <th className="text-left px-5 py-2.5">Start</th>
                <th className="text-left px-5 py-2.5">End</th>
                <th className="text-left px-5 py-2.5">Status</th>
                <th className="text-right px-5 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const studentName = `${t.studentFirstName} ${t.studentLastName}`;
                return (
                  <tr
                    key={`${t.classId}-${t.studentId}`}
                    className="border-b border-line hover:bg-surface-2 transition-colors"
                  >
                    <td className="px-5 py-3 text-[13px] font-bold text-ink">
                      {studentName}
                    </td>
                    <td className="px-5 py-3 text-[13px] text-ink-soft">
                      {t.className}
                      <span className="text-muted"> · {t.subjectName}</span>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-ink-soft">
                      {t.tutorFirstName} {t.tutorLastName}
                    </td>
                    <td className="px-5 py-3 text-[12px] text-ink-soft tabular-nums">
                      {t.trialStartsAt ? formatDateShort(t.trialStartsAt) : "-"}
                    </td>
                    <td className="px-5 py-3 text-[12px] text-ink-soft tabular-nums">
                      {t.trialEndsAt ? formatDateShort(t.trialEndsAt) : "-"}
                    </td>
                    <td className="px-5 py-3">
                      {t.status === "trial_ended" ? (
                        <Pill tone="bad">Trial ended</Pill>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Pill tone={t.endingSoon ? "warn" : "info"}>
                            On trial
                          </Pill>
                          {t.endingSoon && (
                            <span className="text-[11px] font-semibold text-warn">
                              Ending soon
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <TrialActions
                        classId={t.classId}
                        studentId={t.studentId}
                        studentName={studentName}
                        classDisplayName={t.className}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default async function TrialsPage() {
  await requireRole("admin");

  const today = new Date().toISOString().slice(0, 10);
  const trials: Trial[] = await getTrials();

  const withStatus: RowWithStatus[] = trials.map((t) => ({
    ...t,
    status: deriveTrialStatus(t.trialStartsAt, t.trialEndsAt, today),
    endingSoon: isEndingSoon(t.trialEndsAt, today),
  }));

  const active = withStatus
    .filter((t) => t.status === "on_trial")
    .sort((a, b) => {
      if (a.endingSoon !== b.endingSoon) return a.endingSoon ? -1 : 1;
      return (a.trialEndsAt ?? "").localeCompare(b.trialEndsAt ?? "");
    });

  const ended = withStatus
    .filter((t) => t.status === "trial_ended")
    .sort((a, b) => (b.trialEndsAt ?? "").localeCompare(a.trialEndsAt ?? ""));

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        className="rise"
        eyebrow="Enrolment Management"
        title="Free trials"
        sub="Students currently on a free trial, and trials that have ended without a follow-up yet."
      />

      {trials.length === 0 ? (
        <Card className="rise">
          <Empty>
            No free trials on record. Set trial dates from a class&apos;s
            enrolled-students list.
          </Empty>
        </Card>
      ) : (
        <>
          <TrialsTable
            eyebrow="Free trials"
            title="Active"
            rows={active}
            emptyLabel="No students currently on a free trial."
          />
          <TrialsTable
            eyebrow="Free trials"
            title="Ended"
            rows={ended}
            emptyLabel="No ended trials."
          />
        </>
      )}
    </div>
  );
}
