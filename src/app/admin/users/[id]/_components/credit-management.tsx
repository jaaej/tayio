"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/select";
import { Card, CardHead, CardBody, Button, Empty, Pill } from "@/components/admin/ui";
import {
  grantAllowanceToStudent,
  grantCreditToStudent,
  undoCancellationForStudent,
  undoRedemptionForStudent,
  undoRescheduleForStudent,
} from "@/app/admin/_lib/actions-credits";

type CreditStatus = "active" | "redeemed" | "expired";

type RescheduleActivity = {
  id: string;
  subjectName: string;
  fromLabel: string;
  toLabel: string;
  reason: string | null;
};

type Redemption = {
  creditId: string;
  lessonId: string;
  label: string;
  subjectName: string;
};

type CancellationActivity = {
  id: string;
  subjectName: string;
  lessonLabel: string;
  reason: string | null;
  creditStatus: CreditStatus | null;
  redemption: Redemption | null;
};

type Summary = {
  termId: string | null;
  termLabel: string | null;
  cancellationsUsed: number;
  reschedulesUsed: number;
  cancellationCap: number;
  rescheduleCap: number;
};

const CREDIT_TONE: Record<CreditStatus, "good" | "info" | "default"> = {
  active: "good",
  redeemed: "info",
  expired: "default",
};

const CREDIT_LABEL: Record<CreditStatus, string> = {
  active: "Credit active",
  redeemed: "Credit used",
  expired: "Credit expired",
};

/** Admin management of a student's reschedule/cancellation history and
 *  allowance: undo past moves, grant a class credit, and top up the per-term
 *  reschedule/cancellation caps. Money- and entitlement-touching, so every
 *  undo is confirm-gated and blocked undos surface the reason inline. */
export function CreditManagement({
  studentId,
  activity,
  subjects,
  summary,
}: {
  studentId: string;
  activity: {
    reschedules: RescheduleActivity[];
    cancellations: CancellationActivity[];
  };
  subjects: { id: string; name: string }[];
  summary: Summary;
}) {
  const [pending, start] = useTransition();
  // Per-row error keyed by activity row id; a single flash for grants.
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");

  const noActivity =
    activity.reschedules.length === 0 && activity.cancellations.length === 0;

  function undoReschedule(id: string, label: string) {
    if (!confirm(`Undo this reschedule?\n\n${label}\n\nThe student returns to the original lesson.`)) {
      return;
    }
    setRowError(null);
    setActionMsg(null);
    start(async () => {
      const res = await undoRescheduleForStudent({
        rescheduleRequestId: id,
        studentId,
      });
      if (!res.ok) setRowError({ id, text: res.error });
    });
  }

  function undoCancellation(id: string, label: string) {
    if (!confirm(`Undo this cancellation?\n\n${label}\n\nThe class credit is removed and the student is back on the lesson.`)) {
      return;
    }
    setRowError(null);
    setActionMsg(null);
    start(async () => {
      const res = await undoCancellationForStudent({
        cancellationId: id,
        studentId,
      });
      if (!res.ok) setRowError({ id, text: res.error });
    });
  }

  function undoRedemption(creditId: string, label: string) {
    if (
      !confirm(
        `Undo this make-up booking?\n\n${label}\n\nThe make-up lesson is removed and the class credit becomes available again. You can then undo the cancellation.`,
      )
    ) {
      return;
    }
    setRowError(null);
    setActionMsg(null);
    start(async () => {
      const res = await undoRedemptionForStudent({ creditId, studentId });
      if (!res.ok) setRowError({ id: creditId, text: res.error });
    });
  }

  function grantCredit() {
    if (!subjectId) return;
    setRowError(null);
    setActionMsg(null);
    start(async () => {
      const res = await grantCreditToStudent({ studentId, subjectId });
      setActionMsg(
        res.ok
          ? { ok: true, text: "Class credit granted." }
          : { ok: false, text: res.error },
      );
    });
  }

  function grantAllowance(kind: "reschedule" | "cancellation") {
    if (!summary.termId) return;
    setRowError(null);
    setActionMsg(null);
    start(async () => {
      const res = await grantAllowanceToStudent({
        studentId,
        termId: summary.termId!,
        kind,
      });
      setActionMsg(
        res.ok
          ? {
              ok: true,
              text: `Added 1 extra ${kind} for ${summary.termLabel ?? "this term"}.`,
            }
          : { ok: false, text: res.error },
      );
    });
  }

  return (
    <>
      <section className="rise" style={{ animationDelay: "130ms" }}>
        <Card>
          <CardHead
            title="Reschedule and cancellation activity"
            eyebrow="Undo"
          />
          {noActivity ? (
            <Empty>No reschedules or cancellations on record.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {activity.reschedules.map((r) => (
                <div
                  key={r.id}
                  className="px-5 py-3.5 flex items-start gap-3 flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-ink">
                        {r.subjectName}
                      </span>
                      <Pill tone="grape">Reschedule</Pill>
                    </div>
                    <div className="mt-0.5 text-[13px] text-ink-soft">
                      <span className="tabular-nums">{r.fromLabel}</span>
                      <span aria-hidden className="mx-1.5 text-muted">
                        &rarr;
                      </span>
                      <span className="tabular-nums">{r.toLabel}</span>
                    </div>
                    {r.reason && (
                      <div className="mt-0.5 text-[12px] text-muted">
                        Reason: {r.reason}
                      </div>
                    )}
                    {rowError?.id === r.id && (
                      <div
                        role="alert"
                        className="mt-1.5 text-[12px] font-semibold text-bad"
                      >
                        {rowError.text}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      undoReschedule(
                        r.id,
                        `${r.subjectName}: ${r.fromLabel} → ${r.toLabel}`,
                      )
                    }
                  >
                    Undo
                  </Button>
                </div>
              ))}

              {activity.cancellations.map((c) => {
                const blocked = c.creditStatus === "redeemed";
                return (
                  <div
                    key={c.id}
                    className="px-5 py-3.5 flex items-start gap-3 flex-wrap"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-bold text-ink">
                          {c.subjectName}
                        </span>
                        <Pill tone="coral">Cancellation</Pill>
                        {c.creditStatus && (
                          <Pill tone={CREDIT_TONE[c.creditStatus]}>
                            {CREDIT_LABEL[c.creditStatus]}
                          </Pill>
                        )}
                      </div>
                      <div className="mt-0.5 text-[13px] text-ink-soft tabular-nums">
                        {c.lessonLabel}
                      </div>
                      {c.reason && (
                        <div className="mt-0.5 text-[12px] text-muted">
                          Reason: {c.reason}
                        </div>
                      )}
                      {blocked && c.redemption && (
                        <div className="mt-2 rounded-[10px] border border-line bg-surface-2/60 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-2">
                                Credit redeemed on
                              </div>
                              <div className="mt-0.5 text-[13px] font-bold text-ink">
                                {c.redemption.subjectName} make-up
                              </div>
                              <div className="text-[12px] text-ink-soft tabular-nums">
                                {c.redemption.label}
                              </div>
                              <div className="mt-1 text-[12px] text-muted">
                                Undo this make-up to free the credit, then the
                                cancellation can be undone.
                              </div>
                              {rowError?.id === c.redemption.creditId && (
                                <div
                                  role="alert"
                                  className="mt-1.5 text-[12px] font-semibold text-bad"
                                >
                                  {rowError.text}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() =>
                                undoRedemption(
                                  c.redemption!.creditId,
                                  `${c.redemption!.subjectName} make-up, ${c.redemption!.label}`,
                                )
                              }
                            >
                              Undo redemption
                            </Button>
                          </div>
                        </div>
                      )}
                      {blocked && !c.redemption && (
                        <div className="mt-1 text-[12px] text-muted">
                          Credit already used - undo the redemption first.
                        </div>
                      )}
                      {rowError?.id === c.id && (
                        <div
                          role="alert"
                          className="mt-1.5 text-[12px] font-semibold text-bad"
                        >
                          {rowError.text}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || blocked}
                      onClick={() =>
                        undoCancellation(
                          c.id,
                          `${c.subjectName}: ${c.lessonLabel}`,
                        )
                      }
                    >
                      Undo
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "150ms" }}>
        <Card accent="brand">
          <CardHead
            title="Admin actions"
            eyebrow={summary.termLabel ?? "No active term"}
          />
          <CardBody className="space-y-5">
            <div className="flex flex-wrap gap-2.5">
              <Pill tone="default">
                Reschedules: {summary.reschedulesUsed} of {summary.rescheduleCap}
              </Pill>
              <Pill tone="default">
                Cancellations: {summary.cancellationsUsed} of{" "}
                {summary.cancellationCap}
              </Pill>
            </div>

            {summary.termId === null ? (
              <p className="text-[13px] text-muted">
                Today falls outside any term, so credits and allowance can't be
                granted right now.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
                    Grant a class credit
                  </div>
                  {subjects.length === 0 ? (
                    <p className="text-[12px] text-muted">
                      This student isn't enrolled in any subject.
                    </p>
                  ) : (
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="sr-only" htmlFor="grant-credit-subject">
                          Subject
                        </label>
                        <Select
                          id="grant-credit-subject"
                          value={subjectId}
                          onChange={(e) => setSubjectId(e.target.value)}
                        >
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button
                        variant="brand"
                        disabled={pending || !subjectId}
                        onClick={grantCredit}
                      >
                        Grant credit
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
                    Grant extra allowance
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() => grantAllowance("reschedule")}
                    >
                      + 1 reschedule
                    </Button>
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() => grantAllowance("cancellation")}
                    >
                      + 1 cancellation
                    </Button>
                  </div>
                </div>
              </>
            )}

            {actionMsg && (
              <div
                role="alert"
                className={
                  actionMsg.ok
                    ? "text-[12px] font-semibold text-good"
                    : "text-[12px] font-semibold text-bad"
                }
              >
                {actionMsg.text}
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </>
  );
}
