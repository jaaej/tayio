"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { createAnnouncement } from "@/app/admin/_lib/actions-announcements";
import { targetSummary } from "@/lib/announcement-rules";
import { cn } from "@/lib/utils";

export type AnnouncementTargetOptions = {
  subjects: { id: string; label: string }[];
  years: string[];
  classes: { id: string; label: string }[];
  tutors: { id: string; label: string }[];
};

type Role = "student" | "parent" | "tutor" | "admin";

const ROLES: { value: Role; label: string }[] = [
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" },
  { value: "tutor", label: "Tutors" },
  { value: "admin", label: "Admins" },
];

const DEFAULT_ROLES: Role[] = ["student"];

const FIELD =
  "w-full rounded-[12px] border border-[#DCDEE9] bg-surface px-3.5 text-[15px] font-medium text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10";

export function CreateAnnouncementForm({
  options,
}: {
  options: AnnouncementTargetOptions;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [yearLevels, setYearLevels] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [tutorIds, setTutorIds] = useState<string[]>([]);
  const [includeLinkedParents, setIncludeLinkedParents] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  const yearOptions = options.years.map((year) => ({ id: year, label: yearLabel(year) }));
  const labelsFor = (ids: string[], list: { id: string; label: string }[]) =>
    ids.map((id) => list.find((entry) => entry.id === id)?.label ?? id);
  const summary =
    roles.length === 0
      ? "Nobody yet"
      : targetSummary(
          { roles, subjectIds, yearLevels, classIds, tutorIds, includeLinkedParents },
          {
            subjects: labelsFor(subjectIds, options.subjects),
            years: labelsFor(yearLevels, yearOptions),
            classes: labelsFor(classIds, options.classes),
            tutors: labelsFor(tutorIds, options.tutors),
          },
        );

  function resetTargets() {
    setRoles(DEFAULT_ROLES);
    setSubjectIds([]);
    setYearLevels([]);
    setClassIds([]);
    setTutorIds([]);
    setIncludeLinkedParents(false);
    setIsUrgent(false);
  }

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        if (roles.length === 0) {
          setError("Pick at least one group to send to.");
          return;
        }
        const form = event.currentTarget;
        const data = new FormData(form);
        start(async () => {
          try {
            const result = await createAnnouncement({
              title: String(data.get("title") ?? ""),
              body: String(data.get("body") ?? ""),
              roles,
              subjectIds,
              yearLevels,
              classIds,
              tutorIds,
              includeLinkedParents,
              isUrgent,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            const emailNote = result.email
              ? result.email.configured
                ? ` Urgent email sent to ${result.email.sent} recipient${result.email.sent === 1 ? "" : "s"}.`
                : " Email is queued; the email provider is not configured in this environment."
              : "";
            setSuccess(
              `Published to ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"}.${emailNote}`,
            );
            form.reset();
            resetTargets();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Publishing failed.");
          }
        });
      }}
    >
      <div className="panel flex flex-col gap-3.5 p-[18px]">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
          Title
          <input
            name="title"
            required
            maxLength={200}
            placeholder="What recipients need to know"
            className={cn(FIELD, "h-11")}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
          Message
          <textarea
            name="body"
            required
            rows={5}
            maxLength={10000}
            placeholder="Write the announcement…"
            className={cn(FIELD, "resize-y py-3 leading-normal")}
          />
        </label>
      </div>

      <div className="panel flex flex-col gap-4 p-[18px]">
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-[13px] font-bold text-ink">
            Send to <span className="font-medium text-muted">· pick at least one</span>
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ROLES.map((role) => {
              const checked = roles.includes(role.value);
              return (
                <label
                  key={role.value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] border-[1.5px] px-3 text-[14px] font-bold text-ink transition-colors focus-within:ring-2 focus-within:ring-brand-400",
                    checked
                      ? "border-ink bg-[#F6F5FB]"
                      : "border-[#E2E4EE] bg-surface hover:bg-[#F8F9FC]",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setRoles((current) =>
                        current.includes(role.value)
                          ? current.filter((value) => value !== role.value)
                          : [...current, role.value],
                      )
                    }
                    className="h-4 w-4 shrink-0 accent-ink"
                  />
                  {role.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-ink">
            Narrow it down{" "}
            <span className="font-medium text-muted">
              · optional, recipients must match every filter used
            </span>
          </span>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2">
            <MultiPick
              label="Subjects"
              noun={["subject", "subjects"]}
              anyLabel="Any subject"
              emptyLabel="No subjects configured"
              options={options.subjects}
              value={subjectIds}
              onChange={setSubjectIds}
            />
            <MultiPick
              label="Year levels"
              noun={["year level", "year levels"]}
              anyLabel="Any year level"
              emptyLabel="No year levels configured"
              options={yearOptions}
              value={yearLevels}
              onChange={setYearLevels}
            />
            <MultiPick
              label="Classes"
              noun={["class", "classes"]}
              anyLabel="Any class"
              emptyLabel="No classes configured"
              options={options.classes}
              value={classIds}
              onChange={setClassIds}
            />
            <MultiPick
              label="Assigned tutors"
              noun={["tutor", "tutors"]}
              anyLabel="Any tutor"
              emptyLabel="No tutors configured"
              options={options.tutors}
              value={tutorIds}
              onChange={setTutorIds}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-line pt-3.5">
          <label className="flex min-h-6 cursor-pointer items-start gap-2.5 text-[14px] font-bold text-ink">
            <input
              type="checkbox"
              checked={includeLinkedParents}
              onChange={(event) => setIncludeLinkedParents(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
            />
            <span>
              Also include linked parents{" "}
              <span className="font-medium text-muted">
                · only parents of students matching these filters
              </span>
            </span>
          </label>
          <label className="flex min-h-6 cursor-pointer items-start gap-2.5 text-[14px] font-bold text-ink">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(event) => setIsUrgent(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
            />
            <span>
              Urgent{" "}
              <span className="font-medium text-muted">
                · also queue an email to these exact recipients
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-1 pt-2">
        <p className="min-w-0 flex-1 text-[13px] font-semibold text-ink-soft">
          To: <strong className="font-extrabold text-ink">{summary}</strong> ·{" "}
          {isUrgent ? "in-app + email" : "in-app only"}
        </p>
        <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-[13px] px-5">
          {pending ? "Publishing…" : "Publish announcement"}
        </Button>
      </div>
      {success || error ? (
        <p
          role="status"
          className={cn(
            "px-3 pb-1 text-[13px] font-semibold",
            error ? "text-bad" : "text-good",
          )}
        >
          {error ?? success}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Select-looking trigger that opens a checklist, so a filter keeps the
 * compact single-select face while still allowing several values.
 */
function MultiPick({
  label,
  noun,
  anyLabel,
  emptyLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  noun: [string, string];
  anyLabel: string;
  emptyLabel: string;
  options: { id: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const disabled = options.length === 0;
  const face = disabled
    ? emptyLabel
    : value.length === 0
      ? anyLabel
      : value.length === 1
        ? (options.find((option) => option.id === value[0])?.label ?? `1 ${noun[0]}`)
        : `${value.length} ${noun[1]}`;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-[5px]">
      <span className="text-[12px] font-bold text-muted">{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${face}`}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-[10px] border px-2.5 text-left text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:text-muted",
          value.length > 0
            ? "border-ink bg-[#F6F5FB] text-ink"
            : "border-[#DCDEE9] bg-surface text-ink hover:bg-[#F8F9FC]",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{face}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={listId}
          role="group"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-30 mt-1 flex max-h-64 min-w-[220px] flex-col overflow-y-auto rounded-[12px] border border-line-strong bg-surface p-1.5 shadow-[0_18px_40px_rgba(23,21,43,0.16)]"
        >
          {value.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 self-start rounded-[8px] px-2 py-1 text-[12px] font-bold text-brand-600 hover:bg-surface-2"
            >
              Clear
            </button>
          ) : null}
          {options.map((option) => {
            const checked = value.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[8px] px-2 text-[13px] font-semibold text-ink hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? value.filter((id) => id !== option.id)
                        : [...value, option.id],
                    )
                  }
                  className="h-4 w-4 shrink-0 accent-ink"
                />
                <span className="min-w-0 flex-1">{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function yearLabel(year: string) {
  return /^year\s/i.test(year) ? year : `Year ${year}`;
}
