"use client";

import { useState, type ReactNode } from "react";
import { Link2 as LinkIcon, Upload } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RESOURCE_TYPES } from "@/lib/resource-types";
import { cn } from "@/lib/utils";

export type ResourceFormSubject = {
  id: string;
  name: string;
  topics: Array<{ id: string; name: string }>;
};

/**
 * Body of the add-resource slide-over. The submit button lives in the panel's
 * footer and reaches back in via `form={formId}`, so the panel owns the
 * pending / error state and this component stays a plain set of fields.
 *
 * Subject is lifted to the panel: opening from a subject section preselects it,
 * and the topic list has to follow whatever subject is currently chosen.
 */
export function ResourceForm({
  formId,
  subjects,
  subjectId,
  onSubjectChange,
  disabled,
  error,
  onSubmit,
}: {
  formId: string;
  subjects: ResourceFormSubject[];
  subjectId: string;
  onSubjectChange: (subjectId: string) => void;
  disabled: boolean;
  error: string | null;
  onSubmit: (formData: FormData) => void;
}) {
  const [kind, setKind] = useState<"file" | "link">("file");

  const topics = subjects.find((s) => s.id === subjectId)?.topics ?? [];

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <fieldset disabled={disabled} className="space-y-5">
        <Field id="subjectId" label="Subject">
          <Select
            id="subjectId"
            name="subjectId"
            required
            value={subjectId}
            onChange={(e) => onSubjectChange(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="type" label="Type">
            <Select id="type" name="type" required defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="topicId" label="Topic">
            {/* Keyed on the subject so switching subject clears a topic that
                belongs to the subject you just moved away from. */}
            <Select key={subjectId} id="topicId" name="topicId" defaultValue="">
              <option value="">No topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field id="title" label="Title">
          <Input id="title" name="title" required maxLength={200} />
        </Field>

        <Field id="description" label="Description">
          <Textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            placeholder="Optional"
          />
        </Field>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Source
          </span>
          <input type="hidden" name="kind" value={kind} />
          <div
            role="radiogroup"
            aria-label="Source"
            className="mt-2 flex flex-wrap gap-2"
          >
            <KindOption
              active={kind === "file"}
              onSelect={() => setKind("file")}
              icon={<Upload className="h-4 w-4" aria-hidden />}
            >
              Upload file
            </KindOption>
            <KindOption
              active={kind === "link"}
              onSelect={() => setKind("link")}
              icon={<LinkIcon className="h-4 w-4" aria-hidden />}
            >
              Paste link
            </KindOption>
          </div>

          <div className="mt-3">
            {kind === "file" ? (
              <Field id="file" label="File">
                <input
                  key="file"
                  id="file"
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt,.mp4,.mov"
                  className="w-full cursor-pointer text-[13px] text-ink file:mr-2.5 file:h-9 file:cursor-pointer file:rounded-[10px] file:border file:border-line-strong file:bg-surface file:px-3 file:text-[12px] file:font-bold file:text-ink"
                />
              </Field>
            ) : (
              <Field id="externalUrl" label="Link">
                <Input
                  key="link"
                  id="externalUrl"
                  name="externalUrl"
                  type="url"
                  required
                  maxLength={2000}
                  placeholder="https://…"
                />
              </Field>
            )}
          </div>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="block font-bold">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * File-vs-link switch. Real radios behind the pills, so arrow-key navigation
 * and screen-reader announcement come from the browser - the same pattern the
 * admin create-user role picker uses.
 */
function KindOption({
  active,
  onSelect,
  icon,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[12px] font-bold transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-1",
        active
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-line-strong bg-surface text-ink hover:border-brand-500 hover:text-brand-700",
      )}
    >
      <input
        type="radio"
        name="kindChoice"
        checked={active}
        onChange={onSelect}
        className="sr-only"
      />
      {icon}
      {children}
    </label>
  );
}
