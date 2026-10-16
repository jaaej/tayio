"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Info, Trash2 } from "lucide-react";
import {
  addRecurringAvailability,
  removeRecurringAvailability,
} from "@/app/tutor/_actions";
import {
  submitSingleCoverRequest,
  submitTutorLeaveRequest,
} from "@/app/_actions/tutor-cover";
import { Button, SidePanel, SubjectDot, type ButtonProps } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

/*
 * One side panel for everything about the hours a tutor can teach: the
 * recurring week, a single class they cannot teach (48-hour rule, posted to the
 * cover board straight away) and extended leave (held for admin approval).
 * Triggers anywhere on the schedule page open it on the right tab.
 */

export type LeaveTab = "hours" | "class" | "leave";

const TABS: { key: LeaveTab; label: string }[] = [
  { key: "hours", label: "Regular hours" },
  { key: "class", label: "One class" },
  { key: "leave", label: "Extended leave" },
];

export type LeaveLessonOption = {
  id: string;
  weekday: string;
  day: string;
  /** "OCT": the list runs across months, so each row names its month. */
  month: string;
  name: string;
  subjectName: string;
  subjectColor: string | null;
  time: string;
  dateLabel: string;
};

export type RegularHoursWindow = {
  key: string;
  dayLabel: string;
  timeLabel: string;
  ruleIds: string[];
};

type Result = { ok: true; message: string } | { ok: false; error: string };
type Status = { good: boolean; text: string } | null;

const FIELD =
  "w-full min-w-0 rounded-[12px] border border-line-field bg-surface px-3.5 text-[15px] text-ink transition-colors placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 disabled:opacity-60";
const LABEL = "text-[13px] font-bold text-ink";

/** Lessons shown before "Show all", so a full term does not flood the panel. */
const LESSONS_SHOWN = 8;

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];
// Whole hours from 6 am to 11 pm, which is what the availability actions accept.
const TIMES = Array.from({ length: 18 }, (_, index) => {
  const hour = index + 6;
  return {
    value: `${String(hour).padStart(2, "0")}:00`,
    label: `${hour % 12 || 12}:00 ${hour < 12 ? "am" : "pm"}`,
  };
});

type PanelContext = { open: (tab: LeaveTab) => void };
const LeavePanelContext = createContext<PanelContext | null>(null);

export function LeavePanelProvider({
  initialTab,
  lessons,
  windows,
  children,
}: {
  /** Open on arrival, e.g. from `?panel=leave`. */
  initialTab: LeaveTab | null;
  lessons: LeaveLessonOption[];
  windows: RegularHoursWindow[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(initialTab !== null);
  const [tab, setTab] = useState<LeaveTab>(initialTab ?? "class");
  const [pending, setPending] = useState(false);
  const formId = useId();

  const openOn = useCallback((next: LeaveTab) => {
    setTab(next);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Drop `?panel=` so a refresh or back navigation does not reopen it.
    if (searchParams.has("panel")) {
      const params = new URLSearchParams(searchParams);
      params.delete("panel");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  const submitLabel =
    tab === "hours" ? "Add hours" : tab === "class" ? "Post class for cover" : "Request leave";
  const pendingLabel =
    tab === "hours" ? "Saving…" : tab === "class" ? "Posting…" : "Sending…";

  return (
    <LeavePanelContext.Provider value={{ open: openOn }}>
      {children}
      <SidePanel
        open={open}
        onClose={close}
        title="Hours & time away"
        sub="Admin is notified when you report an absence or leave."
        sections
        footer={
          <>
            <Button type="button" size="lg" variant="glass" onClick={close}>
              {tab === "hours" ? "Done" : "Cancel"}
            </Button>
            <Button
              type="submit"
              form={formId}
              size="lg"
              variant="primary"
              disabled={pending || (tab === "class" && lessons.length === 0)}
            >
              {pending ? pendingLabel : submitLabel}
            </Button>
          </>
        }
      >
        <div
          role="tablist"
          aria-label="Request type"
          className="mx-1.5 mb-0.5 flex gap-0.5 rounded-[12px] border border-white/90 bg-white/60 p-[3px]"
        >
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`${formId}-tab-${item.key}`}
              aria-selected={tab === item.key}
              aria-controls={`${formId}-panel`}
              disabled={pending}
              onClick={() => setTab(item.key)}
              className={cn(
                "h-10 flex-1 rounded-[9px] px-1 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                tab === item.key
                  ? "bg-ink text-white"
                  : "text-ink-soft hover:bg-white/80 hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          id={`${formId}-panel`}
          role="tabpanel"
          aria-labelledby={`${formId}-tab-${tab}`}
          className="flex flex-col gap-1.5"
        >
          {/* Keyed by tab so each form starts clean when the tab changes. */}
          {tab === "hours" && (
            <RegularHoursForm key="hours" formId={formId} windows={windows} onPending={setPending} />
          )}
          {tab === "class" && (
            <OneClassForm key="class" formId={formId} lessons={lessons} onPending={setPending} />
          )}
          {tab === "leave" && (
            <ExtendedLeaveForm key="leave" formId={formId} onPending={setPending} />
          )}
        </div>
      </SidePanel>
    </LeavePanelContext.Provider>
  );
}

/** A button that opens the panel on one tab. */
export function LeavePanelTrigger({
  tab,
  children,
  ...props
}: { tab: LeaveTab; children: ReactNode } & Omit<ButtonProps, "onClick" | "type">) {
  const context = useContext(LeavePanelContext);
  return (
    <Button type="button" {...props} onClick={() => context?.open(tab)}>
      {children}
    </Button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="panel flex flex-col gap-3.5 p-[18px]">
      <h3 id={id} className="text-[13px] font-extrabold text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p
      role={status.good ? "status" : "alert"}
      className={cn(
        "rounded-[12px] px-3.5 py-2.5 text-[13px] font-semibold",
        status.good ? "bg-good-bg text-good" : "bg-bad-bg text-bad",
      )}
    >
      {status.text}
    </p>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-[12px] bg-surface-2 px-3 py-2.5 text-[13px] leading-[1.45] text-ink-soft">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Runs a server action for a panel form and reports pending to the footer. */
function useSubmit(onPending: (pending: boolean) => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  function run(action: () => Promise<Result>, onSuccess?: () => void) {
    setStatus(null);
    onPending(true);
    start(async () => {
      try {
        const result = await action();
        setStatus({ good: result.ok, text: result.ok ? result.message : result.error });
        if (result.ok) {
          onSuccess?.();
          router.refresh();
        }
      } catch {
        setStatus({ good: false, text: "Something went wrong. Try again." });
      } finally {
        onPending(false);
      }
    });
  }
  return { pending, status, run };
}

function SelectField({
  id,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block min-w-0">
      <select
        id={id}
        {...props}
        className={cn(FIELD, "h-11 cursor-pointer appearance-none pr-9 text-[14px]", className)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
}

function RegularHoursForm({
  formId,
  windows,
  onPending,
}: {
  formId: string;
  windows: RegularHoursWindow[];
  onPending: (pending: boolean) => void;
}) {
  const { pending, status, run } = useSubmit(onPending);
  const ids = useId();

  return (
    <>
      <Section title="Add hours you can teach every week">
        <form
          id={formId}
          action={(formData) => run(() => addRecurringAvailability(formData))}
          className="grid grid-cols-2 gap-3.5"
        >
          <div className="col-span-2 flex flex-col gap-1.5">
            <label htmlFor={`${ids}-day`} className={LABEL}>
              Day
            </label>
            <SelectField id={`${ids}-day`} name="weekday" defaultValue="1" disabled={pending}>
              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-from`} className={LABEL}>
              From
            </label>
            <SelectField id={`${ids}-from`} name="startTime" defaultValue="15:00" required disabled={pending}>
              {TIMES.map((time) => (
                <option key={time.value} value={time.value}>
                  {time.label}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-until`} className={LABEL}>
              Until
            </label>
            <SelectField id={`${ids}-until`} name="endTime" defaultValue="18:00" required disabled={pending}>
              {TIMES.map((time) => (
                <option key={time.value} value={time.value}>
                  {time.label}
                </option>
              ))}
            </SelectField>
          </div>
        </form>
        <StatusLine status={status} />
      </Section>

      <Section title="Your regular week">
        {windows.length === 0 ? (
          <p className="text-[14px] text-muted">No regular hours yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {windows.map((window) => (
              <li key={window.key} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-ink">{window.dayLabel}</span>
                  <span className="block text-[13px] tabular-nums text-ink-soft">{window.timeLabel}</span>
                </span>
                <form
                  action={(formData) => run(() => removeRecurringAvailability(formData))}
                >
                  {window.ruleIds.map((id) => (
                    <input key={id} type="hidden" name="ruleId" value={id} />
                  ))}
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={pending}
                    aria-label={`Remove ${window.dayLabel} ${window.timeLabel}`}
                    className="h-10 hover:border-bad hover:text-bad"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function OneClassForm({
  formId,
  lessons,
  onPending,
}: {
  formId: string;
  lessons: LeaveLessonOption[];
  onPending: (pending: boolean) => void;
}) {
  const { pending, status, run } = useSubmit(onPending);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const reasonId = useId();
  const shown = showAll ? lessons : lessons.slice(0, LESSONS_SHOWN);

  return (
    <Section title="I can’t teach one class">
      <form
        ref={formRef}
        id={formId}
        action={(formData) =>
          run(
            () => submitSingleCoverRequest(formData),
            () => {
              formRef.current?.reset();
              setSelected(null);
            },
          )
        }
        className="flex flex-col gap-3.5"
      >
        {lessons.length === 0 ? (
          <p className="text-[14px] text-muted">
            You have no classes 48 hours or more away that can be posted.
          </p>
        ) : (
          <fieldset className="flex min-w-0 flex-col gap-1.5" disabled={pending}>
            <legend className={cn(LABEL, "pb-1.5")}>Class</legend>
            {shown.map((lesson) => {
              const on = selected === lesson.id;
              return (
                <label
                  key={lesson.id}
                  className={cn(
                    "flex min-h-[60px] cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
                    on ? "border-ink bg-[#F7F6FE]" : "border-line-strong bg-surface hover:bg-surface-2",
                  )}
                >
                  <input
                    type="radio"
                    name="lessonId"
                    value={lesson.id}
                    required
                    checked={on}
                    onChange={() => setSelected(lesson.id)}
                    className="h-[18px] w-[18px] shrink-0 accent-ink"
                    aria-label={`${lesson.name}, ${lesson.dateLabel}, ${lesson.time}`}
                  />
                  <span aria-hidden className="flex w-11 shrink-0 flex-col items-center leading-[1.1]">
                    <span className="text-[10px] font-extrabold text-muted">{lesson.weekday}</span>
                    <span className="text-[16px] font-extrabold tabular-nums text-ink">{lesson.day}</span>
                    <span className="text-[10px] font-extrabold text-muted">{lesson.month}</span>
                  </span>
                  <span aria-hidden className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink">
                      <SubjectDot subject={lesson.subjectName} color={lesson.subjectColor} className="h-2 w-2" />
                      <span className="truncate">{lesson.name}</span>
                    </span>
                    <span className="text-[12px] tabular-nums text-muted">{lesson.time}</span>
                  </span>
                </label>
              );
            })}
            {lessons.length > LESSONS_SHOWN && (
              <Button
                type="button"
                variant="ghost"
                className="h-10 self-start"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? "Show fewer" : `Show all ${lessons.length} classes`}
              </Button>
            )}
          </fieldset>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={reasonId} className={LABEL}>
            Reason
          </label>
          <textarea
            id={reasonId}
            name="reason"
            rows={4}
            required
            maxLength={2000}
            disabled={pending || lessons.length === 0}
            placeholder="What admin and the covering tutor need to know"
            className={cn(FIELD, "resize-y py-2.5")}
          />
        </div>
        <Note>
          Only classes at least 48 hours away can be posted. It goes straight onto
          the cover board for other tutors.
        </Note>
      </form>
      <StatusLine status={status} />
    </Section>
  );
}

function ExtendedLeaveForm({
  formId,
  onPending,
}: {
  formId: string;
  onPending: (pending: boolean) => void;
}) {
  const { pending, status, run } = useSubmit(onPending);
  const formRef = useRef<HTMLFormElement>(null);
  const ids = useId();

  return (
    <Section title="I’m away for more than one day">
      <form
        ref={formRef}
        id={formId}
        action={(formData) =>
          run(
            () => submitTutorLeaveRequest(formData),
            () => formRef.current?.reset(),
          )
        }
        className="flex flex-col gap-3.5"
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${ids}-start`} className={LABEL}>
              First day away
            </label>
            <input id={`${ids}-start`} type="date" name="startDate" required disabled={pending} className={cn(FIELD, "h-11")} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${ids}-end`} className={LABEL}>
              Last day away
            </label>
            <input id={`${ids}-end`} type="date" name="endDate" required disabled={pending} className={cn(FIELD, "h-11")} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-reason`} className={LABEL}>
            Reason
          </label>
          <textarea
            id={`${ids}-reason`}
            name="reason"
            rows={4}
            required
            maxLength={2000}
            disabled={pending}
            placeholder="Reason for leave and any handover notes"
            className={cn(FIELD, "resize-y py-2.5")}
          />
        </div>
        <Note>
          Leave of 2 to 90 days needs admin approval. Once approved, every affected
          class is posted for cover. Submit at least 48 hours before your first
          class.
        </Note>
      </form>
      <StatusLine status={status} />
    </Section>
  );
}
