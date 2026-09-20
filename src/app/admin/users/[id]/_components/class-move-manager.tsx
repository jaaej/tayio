"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  adminMoveStudent,
  approvePermanentClassMove,
  rejectPermanentClassMove,
} from "@/app/_actions/class-moves";
import type { ClassMoveData, ClassMoveOption } from "@/lib/class-moves";
import { SidePanel } from "@/components/ui/side-panel";
import { LoadingButton } from "@/components/ui/loading-button";

const STATUS_META = {
  approved: { label: "Approved", className: "bg-good-bg text-good" },
  rejected: { label: "Declined", className: "bg-bad-bg text-bad" },
  cancelled: { label: "Superseded", className: "bg-surface-3 text-muted" },
  pending: { label: "Pending", className: "bg-warn-bg text-warn" },
} as const;

export function ClassMoveManager({
  studentId,
  studentName,
  data,
}: {
  studentId: string;
  studentName: string;
  data: ClassMoveData;
}) {
  const router = useRouter();
  const current = data.classes.filter((item) => item.isCurrent);
  const pendingRequests = data.requests.filter((item) => item.status === "pending");
  const history = data.requests.filter((item) => item.status !== "pending");
  const [panelOpen, setPanelOpen] = useState(false);
  const [fromClassId, setFromClassId] = useState(current[0]?.id ?? "");
  const [toClassId, setToClassId] = useState("");
  const [reason, setReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const source = data.classes.find((item) => item.id === fromClassId);
  const targets = useMemo(
    () =>
      data.classes.filter(
        (item) =>
          !item.isCurrent &&
          !!source &&
          item.subjectId === source.subjectId,
      ),
    [data.classes, source],
  );
  const hasAlternative = current.some((item) =>
    data.classes.some(
      (candidate) =>
        !candidate.isCurrent &&
        candidate.subjectId === item.subjectId &&
        candidate.enrolled < candidate.capacity,
    ),
  );

  async function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        const message = result.error ?? "Action failed.";
        setError(message);
        throw new Error(message);
      }
      setSuccess(result.message ?? "Saved.");
      setRejectingId(null);
      setRejectNote("");
      setPanelOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="class-moves" className="scroll-mt-24 rounded-[16px] border border-line bg-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
            <CalendarClock className="h-[18px] w-[18px] text-brand-600" aria-hidden />
            Recurring classes and permanent moves
          </h3>
          <p className="mt-1 text-[12px] text-muted">
            Review family requests or relocate this student directly.
          </p>
        </div>
        <button
          type="button"
          disabled={!hasAlternative}
          onClick={() => {
            setPanelOpen(true);
            setError(null);
            setSuccess(null);
          }}
          className="min-h-11 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          Move student
        </button>
      </div>

      {(error || success) && (
        <p
          role={error ? "alert" : "status"}
          className={`border-b px-5 py-3 text-[12px] font-semibold ${
            error
              ? "border-bad/20 bg-bad-bg text-bad"
              : "border-good/20 bg-good-bg text-good"
          }`}
        >
          {error ?? success}
        </p>
      )}

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            Current recurring classes
          </div>
          {current.length === 0 ? (
            <p className="rounded-[12px] bg-surface-2 px-4 py-3 text-[12px] text-muted">
              No active class enrolments.
            </p>
          ) : (
            <div className="space-y-2">
              {current.map((item) => (
                <ClassCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            <span>Requests needing approval</span>
            <span className="rounded-full bg-warn-bg px-2 py-1 text-warn">
              {pendingRequests.length}
            </span>
          </div>
          {pendingRequests.length === 0 ? (
            <p className="rounded-[12px] bg-surface-2 px-4 py-3 text-[12px] text-muted">
              No pending permanent-move requests.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="rounded-[12px] border border-warn/25 bg-warn-bg/55 p-4">
                  <div className="text-[12px] font-extrabold text-ink">
                    {request.fromLabel}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
                    <span>{request.fromSchedule}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                    <span>{request.toSchedule}</span>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">
                    {request.reason}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Requested by {request.requestedByName}
                  </p>

                  {rejectingId === request.id ? (
                    <div className="mt-3 space-y-2 border-t border-warn/20 pt-3">
                      <textarea
                        value={rejectNote}
                        onChange={(event) => setRejectNote(event.target.value)}
                        rows={3}
                        maxLength={2000}
                        placeholder="Optional explanation for the family"
                        className="w-full resize-y rounded-[10px] border border-line-field bg-surface px-3 py-2.5 text-[12px] text-ink outline-none focus:border-brand-500"
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setRejectingId(null)}
                          className="min-h-10 rounded-full border border-line-field bg-surface px-3.5 text-[11px] font-bold text-ink"
                        >
                          Keep pending
                        </button>
                        <LoadingButton
                          disabled={busy}
                          variant="danger"
                          size="sm"
                          pendingLabel="Declining…"
                          successLabel="Declined"
                          errorLabel="Try again"
                          onAction={() =>
                            run(() =>
                              rejectPermanentClassMove({
                                requestId: request.id,
                                note: rejectNote,
                              }),
                            )
                          }
                        >
                          Confirm decline
                        </LoadingButton>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-warn/20 pt-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRejectingId(request.id)}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-bad/30 bg-surface px-3.5 text-[11px] font-bold text-bad"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                        Decline
                      </button>
                      <LoadingButton
                        disabled={busy}
                        variant="success"
                        size="sm"
                        pendingLabel="Moving…"
                        successLabel="Moved"
                        errorLabel="Try again"
                        onAction={() =>
                          run(() =>
                            approvePermanentClassMove({ requestId: request.id }),
                          )
                        }
                      >
                        Approve and move
                      </LoadingButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            Recent move history
          </div>
          <div className="space-y-2">
            {history.slice(0, 5).map((request) => {
              const meta = STATUS_META[request.status];
              return (
                <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-surface-2 px-3.5 py-3">
                  <div className="min-w-0 text-[12px] text-ink-soft">
                    <span className="font-bold text-ink">{request.fromSchedule}</span>
                    <span> → </span>
                    <span className="font-bold text-ink">{request.toSchedule}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SidePanel
        open={panelOpen}
        onClose={() => !busy && setPanelOpen(false)}
        size="wide"
        title={`Move ${studentName} to another class`}
        sub="This takes effect immediately, preserves an audit record, and notifies the student, family, and both tutors."
      >
        <form
          className="space-y-5"
          onSubmit={(event) => event.preventDefault()}
        >
          <MoveField label="Move from">
            <select
              value={fromClassId}
              onChange={(event) => {
                setFromClassId(event.target.value);
                setToClassId("");
              }}
              className={SELECT_CLASS}
              required
            >
              {current.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.subjectName} · {item.scheduleLabel}
                </option>
              ))}
            </select>
            {source && <ClassCard item={source} />}
          </MoveField>

          <MoveField label="Move to">
            <select
              value={toClassId}
              onChange={(event) => setToClassId(event.target.value)}
              className={SELECT_CLASS}
              required
            >
              <option value="">Choose another recurring class</option>
              {targets.map((item) => {
                const full = item.enrolled >= item.capacity;
                return (
                  <option key={item.id} value={item.id} disabled={full}>
                    {item.scheduleLabel} · {item.tutorName}
                    {full ? " · Full" : ` · ${item.capacity - item.enrolled} places left`}
                  </option>
                );
              })}
            </select>
          </MoveField>

          <MoveField label="Office reason / note">
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={5}
              maxLength={2000}
              required
              placeholder="Why the recurring class is being changed"
              className="w-full resize-y rounded-[12px] border border-line-field bg-surface px-3.5 py-3 text-[14px] text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
            />
          </MoveField>

          {error && (
            <p role="alert" className="rounded-[10px] bg-bad-bg px-3.5 py-3 text-[12px] font-semibold text-bad">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => setPanelOpen(false)}
              className="min-h-11 rounded-full border border-line-field bg-surface px-4 text-[12px] font-bold text-ink"
            >
              Cancel
            </button>
            <LoadingButton
              disabled={busy || !toClassId || !reason.trim()}
              variant="brand"
              pendingLabel="Moving…"
              successLabel="Moved"
              errorLabel="Try again"
              onAction={() =>
                run(() =>
                  adminMoveStudent({
                    studentId,
                    fromClassId,
                    toClassId,
                    reason,
                  }),
                )
              }
            >
              Confirm permanent move
            </LoadingButton>
          </div>
        </form>
      </SidePanel>
    </section>
  );
}

const SELECT_CLASS =
  "min-h-11 w-full rounded-[12px] border border-line-field bg-surface px-3.5 text-[14px] font-semibold text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15";

function MoveField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function ClassCard({ item }: { item: ClassMoveOption }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface-2 px-4 py-3">
      <div className="text-[12px] font-extrabold text-ink">{item.label}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-muted">
        {item.scheduleLabel} · {item.tutorName}
        {item.location ? ` · ${item.location}` : ""}
      </div>
    </div>
  );
}
