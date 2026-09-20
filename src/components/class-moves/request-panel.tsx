"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestPermanentClassMove } from "@/app/_actions/class-moves";
import type {
  ClassMoveHistoryRow,
  ClassMoveOption,
} from "@/lib/class-moves";
import { SidePanel } from "@/components/ui/side-panel";
import { ActionButtonLabel } from "@/components/ui/loading-button";

const STATUS_LABEL = {
  pending: "Waiting for office approval",
  approved: "Approved",
  rejected: "Declined",
  cancelled: "Cancelled",
} as const;

export function ClassMoveRequestPanel({
  studentId,
  studentName,
  classes,
  requests,
}: {
  studentId: string;
  studentName?: string;
  classes: ClassMoveOption[];
  requests: ClassMoveHistoryRow[];
}) {
  const router = useRouter();
  const current = classes.filter((item) => item.isCurrent);
  const [open, setOpen] = useState(false);
  const [fromClassId, setFromClassId] = useState(current[0]?.id ?? "");
  const [toClassId, setToClassId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const source = classes.find((item) => item.id === fromClassId);
  const targets = useMemo(
    () =>
      classes.filter(
        (item) =>
          !item.isCurrent &&
          !!source &&
          item.subjectId === source.subjectId,
      ),
    [classes, source],
  );
  const hasAlternative = current.some((item) =>
    classes.some(
      (candidate) =>
        !candidate.isCurrent &&
        candidate.subjectId === item.subjectId &&
        candidate.enrolled < candidate.capacity,
    ),
  );
  const pendingRequests = requests.filter((request) => request.status === "pending");

  function selectSource(value: string) {
    setFromClassId(value);
    setToClassId("");
    setError(null);
  }

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  return (
    <section className="rounded-[16px] border border-line bg-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[14px] font-extrabold text-ink">
            <CalendarClock className="h-[18px] w-[18px] text-brand-600" aria-hidden />
            Permanent class time
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Request a different weekly class. The office must approve before
            the timetable changes.
          </p>
        </div>
        <button
          type="button"
          disabled={!hasAlternative}
          onClick={() => {
            setOpen(true);
            setSuccess(null);
          }}
          className="inline-flex min-h-11 items-center rounded-full bg-brand-600 px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Request class move
        </button>
      </div>

      {!hasAlternative && current.length > 0 && (
        <p className="border-t border-line bg-surface-2 px-5 py-3 text-[12px] text-muted">
          No alternative class with space is currently available for the same
          subject. Contact the office for other options.
        </p>
      )}
      {success && (
        <p className="border-t border-good/20 bg-good-bg px-5 py-3 text-[12px] font-semibold text-good">
          {success}
        </p>
      )}
      {pendingRequests.length > 0 && (
        <div className="border-t border-line px-5 py-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            Pending request{pendingRequests.length === 1 ? "" : "s"}
          </div>
          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-[12px] border border-warn/25 bg-warn-bg px-3.5 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-ink">
                  <span>{request.fromSchedule}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
                  <span>{request.toSchedule}</span>
                </div>
                <p className="mt-1 text-[11px] text-warn">
                  {STATUS_LABEL[request.status]}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <SidePanel
        open={open}
        onClose={close}
        size="wide"
        title={`Request a permanent class move${studentName ? ` for ${studentName}` : ""}`}
        sub="Choose another recurring class for the same subject. Your existing timetable stays unchanged until admin approves."
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setSuccess(null);
            startTransition(async () => {
              const result = await requestPermanentClassMove({
                studentId,
                fromClassId,
                toClassId,
                reason,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setSuccess(result.message);
              setReason("");
              setToClassId("");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <Field label="Current class">
            <select
              value={fromClassId}
              onChange={(event) => selectSource(event.target.value)}
              required
              className={SELECT_CLASS}
            >
              {current.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.subjectName} · {item.scheduleLabel}
                </option>
              ))}
            </select>
            {source && <ClassDetails item={source} />}
          </Field>

          <Field label="Preferred new class">
            <select
              value={toClassId}
              onChange={(event) => setToClassId(event.target.value)}
              required
              className={SELECT_CLASS}
            >
              <option value="">Choose a new weekly time</option>
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
            {toClassId && (
              <ClassDetails item={classes.find((item) => item.id === toClassId)!} />
            )}
          </Field>

          <Field label="Reason for moving">
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={6}
              maxLength={2000}
              required
              placeholder="Tell the office why this weekly class time no longer works and anything they should know."
              className="w-full resize-y rounded-[12px] border border-line-field bg-surface px-3.5 py-3 text-[14px] text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-[10px] bg-bad-bg px-3.5 py-3 text-[12px] font-semibold text-bad">
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="min-h-11 rounded-full border border-line-field bg-surface px-4 text-[12px] font-bold text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !fromClassId || !toClassId || reason.trim().length < 5}
              className="min-h-11 rounded-full bg-brand-600 px-5 text-[12px] font-bold text-white disabled:opacity-45"
            >
              <ActionButtonLabel pending={pending} pendingLabel="Sending…">
                Send request to office
              </ActionButtonLabel>
            </button>
          </div>
        </form>
      </SidePanel>
    </section>
  );
}

const SELECT_CLASS =
  "min-h-11 w-full rounded-[12px] border border-line-field bg-surface px-3.5 text-[14px] font-semibold text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function ClassDetails({ item }: { item: ClassMoveOption }) {
  return (
    <div className="rounded-[10px] bg-surface-2 px-3.5 py-3 text-[12px] leading-relaxed text-ink-soft">
      <span className="font-bold text-ink">{item.label}</span>
      <span> · {item.scheduleLabel}</span>
      <span> · {item.tutorName}</span>
      {item.location && <span> · {item.location}</span>}
    </div>
  );
}
