"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff } from "lucide-react";
import {
  claimTutorCover,
  releaseTutorCover,
  submitSingleCoverRequest,
  submitTutorLeaveRequest,
} from "@/app/_actions/tutor-cover";
import { SidePanel } from "@/components/ui/side-panel";

type EligibleLesson = {
  id: string;
  label: string;
};

const FIELD =
  "min-h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

export function AbsenceLeavePanel({
  lessons,
  initialOpen = false,
}: {
  lessons: EligibleLesson[];
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
      >
        <CalendarOff className="h-4 w-4" aria-hidden />
        Absence or leave request
      </button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Absence or leave request"
        sub="Report one assigned class or request an extended period of leave."
        size="wide"
      >
        <div className="mb-4 rounded-[12px] border border-brand-200 bg-brand-50 px-4 py-3 text-[12px] leading-relaxed text-brand-ink">
          Admin is notified when you submit. Extended leave requires approval
          before affected classes appear on the cover board.
        </div>
        <CoverRequestForms lessons={lessons} />
      </SidePanel>
    </>
  );
}

export function CoverRequestForms({ lessons }: { lessons: EligibleLesson[] }) {
  const singleForm = useRef<HTMLFormElement>(null);
  const leaveForm = useRef<HTMLFormElement>(null);
  const [singlePending, startSingle] = useTransition();
  const [leavePending, startLeave] = useTransition();
  const [singleStatus, setSingleStatus] = useState<{
    tone: "good" | "bad";
    text: string;
  } | null>(null);
  const [leaveStatus, setLeaveStatus] = useState<{
    tone: "good" | "bad";
    text: string;
  } | null>(null);

  function submitSingle(formData: FormData) {
    setSingleStatus(null);
    startSingle(async () => {
      const result = await submitSingleCoverRequest(formData);
      setSingleStatus({
        tone: result.ok ? "good" : "bad",
        text: result.ok ? result.message : result.error,
      });
      if (result.ok) singleForm.current?.reset();
    });
  }

  function submitLeave(formData: FormData) {
    setLeaveStatus(null);
    startLeave(async () => {
      const result = await submitTutorLeaveRequest(formData);
      setLeaveStatus({
        tone: result.ok ? "good" : "bad",
        text: result.ok ? result.message : result.error,
      });
      if (result.ok) leaveForm.current?.reset();
    });
  }

  return (
    <div className="grid gap-4">
      <form
        ref={singleForm}
        action={submitSingle}
        className="space-y-3 rounded-[18px] border border-line bg-surface p-4"
      >
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">
            I can’t teach one class
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Submit at least 48 hours before the class. It goes straight to the
            tutor notice board and admin is notified.
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            Class
          </span>
          <select name="lessonId" required className={FIELD} defaultValue="">
            <option value="" disabled>
              {lessons.length ? "Choose a class…" : "No eligible classes"}
            </option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            Reason
          </span>
          <textarea
            name="reason"
            rows={5}
            required
            maxLength={2000}
            placeholder="Tell admin and the covering tutor what they need to know."
            className={`${FIELD} py-2.5`}
          />
        </label>
        <Status value={singleStatus} />
        <button
          type="submit"
          disabled={singlePending || lessons.length === 0}
          className="min-h-10 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {singlePending ? "Posting…" : "Post class for cover"}
        </button>
      </form>

      <form
        ref={leaveForm}
        action={submitLeave}
        className="space-y-3 rounded-[18px] border border-line bg-surface p-4"
      >
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">
            I’m away for an extended period
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Date-range leave needs admin approval. Once approved, every
            affected class is posted separately for tutors to cover.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              First day away
            </span>
            <input type="date" name="startDate" required className={FIELD} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Last day away
            </span>
            <input type="date" name="endDate" required className={FIELD} />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            Reason
          </span>
          <textarea
            name="reason"
            rows={5}
            required
            maxLength={2000}
            placeholder="Reason for leave and any handover notes."
            className={`${FIELD} py-2.5`}
          />
        </label>
        <Status value={leaveStatus} />
        <button
          type="submit"
          disabled={leavePending}
          className="min-h-10 rounded-full bg-ink px-4 text-[12px] font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {leavePending ? "Sending…" : "Request extended leave"}
        </button>
      </form>
    </div>
  );
}

export function CoverActionButton({
  coverRequestId,
  mode,
}: {
  coverRequestId: string;
  mode: "claim" | "release";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result =
              mode === "claim"
                ? await claimTutorCover(coverRequestId)
                : await releaseTutorCover(coverRequestId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
        className={
          mode === "claim"
            ? "min-h-9 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            : "min-h-9 rounded-full border border-line-strong bg-surface px-4 text-[12px] font-bold text-ink hover:border-bad hover:text-bad disabled:opacity-50"
        }
      >
        {pending
          ? mode === "claim"
            ? "Claiming…"
            : "Releasing…"
          : mode === "claim"
            ? "Take this class"
            : "Release cover"}
      </button>
      {error && <p className="mt-1 max-w-52 text-[11px] text-bad">{error}</p>}
    </div>
  );
}

function Status({
  value,
}: {
  value: { tone: "good" | "bad"; text: string } | null;
}) {
  if (!value) return null;
  return (
    <p
      role="status"
      className={value.tone === "good" ? "text-[12px] text-good" : "text-[12px] text-bad"}
    >
      {value.text}
    </p>
  );
}
