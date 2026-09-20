"use client";

import { Children, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAnnouncement } from "@/app/admin/_lib/actions-announcements";

export type AnnouncementTargetOptions = {
  subjects: { id: string; label: string }[];
  years: string[];
  classes: { id: string; label: string }[];
  tutors: { id: string; label: string }[];
};

const ROLES = [
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" },
  { value: "tutor", label: "Tutors" },
  { value: "admin", label: "Admins" },
] as const;

export function CreateAnnouncementForm({
  options,
}: {
  options: AnnouncementTargetOptions;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        const form = event.currentTarget;
        const data = new FormData(form);
        start(async () => {
          try {
            const result = await createAnnouncement({
              title: String(data.get("title") ?? ""),
              body: String(data.get("body") ?? ""),
              roles: data.getAll("roles").map(String) as Array<
                "student" | "parent" | "tutor" | "admin"
              >,
              subjectIds: data.getAll("subjectIds").map(String),
              yearLevels: data.getAll("yearLevels").map(String),
              classIds: data.getAll("classIds").map(String),
              tutorIds: data.getAll("tutorIds").map(String),
              includeLinkedParents: data.get("includeLinkedParents") === "on",
              isUrgent: data.get("isUrgent") === "on",
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
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Publishing failed.");
          }
        });
      }}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="announcement-title">Title</Label>
          <Input
            id="announcement-title"
            name="title"
            required
            maxLength={200}
            placeholder="What recipients need to know"
          />
        </div>
        <div className="flex items-end gap-4 pb-2">
          <CheckOption
            name="isUrgent"
            label="Urgent"
            description="Also queue an email to these exact recipients"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="announcement-body">Message</Label>
        <Textarea
          id="announcement-body"
          name="body"
          required
          rows={5}
          maxLength={10000}
          placeholder="Write the announcement…"
        />
      </div>

      <div className="rounded-[14px] border border-line bg-surface-2 p-4">
        <div className="mb-4">
          <div className="text-[13px] font-extrabold text-ink">Choose recipients</div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Choose one or more roles. Optional subject, year, class and tutor
            filters work together, so recipients must match every filter group
            you use.
          </p>
        </div>
        <TargetGroup title="Roles" required>
          {ROLES.map((role) => (
            <Choice
              key={role.value}
              name="roles"
              value={role.value}
              label={role.label}
              defaultChecked={role.value === "student"}
            />
          ))}
        </TargetGroup>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <TargetGroup title="Subjects" empty="No subjects configured">
            {options.subjects.map((subject) => (
              <Choice
                key={subject.id}
                name="subjectIds"
                value={subject.id}
                label={subject.label}
              />
            ))}
          </TargetGroup>
          <TargetGroup title="Year levels" empty="No year levels configured">
            {options.years.map((year) => (
              <Choice
                key={year}
                name="yearLevels"
                value={year}
                label={yearLabel(year)}
              />
            ))}
          </TargetGroup>
          <TargetGroup title="Classes" empty="No classes configured">
            {options.classes.map((entry) => (
              <Choice
                key={entry.id}
                name="classIds"
                value={entry.id}
                label={entry.label}
              />
            ))}
          </TargetGroup>
          <TargetGroup title="Assigned tutors" empty="No tutors configured">
            {options.tutors.map((tutor) => (
              <Choice
                key={tutor.id}
                name="tutorIds"
                value={tutor.id}
                label={tutor.label}
              />
            ))}
          </TargetGroup>
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <CheckOption
            name="includeLinkedParents"
            label="Also include linked parents"
            description="Adds only the parents linked to students matching these filters"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Publishing…" : "Publish announcement"}
        </Button>
        {success ? (
          <span className="text-[12px] font-semibold text-good">{success}</span>
        ) : null}
        {error ? (
          <span className="text-[12px] font-semibold text-bad">{error}</span>
        ) : null}
      </div>
    </form>
  );
}

function TargetGroup({
  title,
  required = false,
  empty,
  children,
}: {
  title: string;
  required?: boolean;
  empty?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-[12px] border border-line bg-surface p-3">
      <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        {title} {required ? <span className="text-bad">*</span> : null}
      </legend>
      <div className="mt-1 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
        {Children.count(children) > 0 ? (
          children
        ) : (
          <span className="text-[12px] text-muted">{empty}</span>
        )}
      </div>
    </fieldset>
  );
}

function Choice({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="inline-flex min-h-8 items-center rounded-full border border-line-strong bg-surface px-3 text-[12px] font-semibold text-ink-soft transition peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
        {label}
      </span>
    </label>
  );
}

function CheckOption({
  name,
  label,
  description,
}: {
  name: string;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        name={name}
        className="mt-0.5 h-4 w-4 rounded border-line-strong accent-brand-600"
      />
      <span>
        <span className="block text-[13px] font-bold text-ink">{label}</span>
        <span className="block text-[11px] leading-relaxed text-muted">
          {description}
        </span>
      </span>
    </label>
  );
}

function yearLabel(year: string) {
  return /^year\s/i.test(year) ? year : `Year ${year}`;
}
