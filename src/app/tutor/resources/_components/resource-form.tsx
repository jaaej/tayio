"use client";

import { useRef, useState, type ReactNode } from "react";
import { FileText, Link2 as LinkIcon, Upload, X } from "lucide-react";
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
  // No source until a file is picked or Paste link is chosen.
  const [kind, setKind] = useState<"file" | "link" | null>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function clearFile() {
    if (fileRef.current) fileRef.current.value = "";
    setFile(null);
  }

  const topics = subjects.find((s) => s.id === subjectId)?.topics ?? [];

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!kind) {
          setSourceError("Upload a file or paste a link.");
          return;
        }
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
          <input type="hidden" name="kind" value={kind ?? ""} />
          {/* Upload file opens the picker itself; the input stays hidden. The
              types `RESOURCE_POLICY` (src/lib/upload-validation.ts) accepts. */}
          <input
            ref={fileRef}
            name="file"
            type="file"
            tabIndex={-1}
            aria-hidden
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.pptx,.xlsx,.mp4,.mov,.webm"
            className="sr-only"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (!picked) return;
              setFile({ name: picked.name, size: picked.size });
              setKind("file");
              setSourceError(null);
            }}
          />
          <div role="group" aria-label="Source" className="mt-2 flex flex-wrap gap-2">
            <KindOption
              active={kind === "file"}
              onSelect={() => fileRef.current?.click()}
              icon={<Upload className="h-4 w-4" aria-hidden />}
            >
              Upload file
            </KindOption>
            <KindOption
              active={kind === "link"}
              onSelect={() => {
                clearFile();
                setKind("link");
                setSourceError(null);
              }}
              icon={<LinkIcon className="h-4 w-4" aria-hidden />}
            >
              Paste link
            </KindOption>
          </div>

          {kind === "file" && file && (
            <div className="mt-3 flex min-h-11 items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 pl-3 pr-1 text-[13px]">
              <FileText className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-bold text-ink" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 tabular-nums text-muted">{fileSize(file.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => {
                  clearFile();
                  setKind(null);
                }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-ink-soft transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
          {kind === "link" && (
            <div className="mt-3">
              {/* Source already says link, so the input needs no label of its own. */}
              <Input
                key="link"
                id="externalUrl"
                name="externalUrl"
                type="url"
                required
                aria-label="Link"
                maxLength={2000}
                placeholder="https://…"
              />
            </div>
          )}
          {sourceError && (
            <p role="alert" className="mt-2 text-[12px] font-semibold text-bad">
              {sourceError}
            </p>
          )}
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

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** One of the two source pills; the chosen one is filled. */
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
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[12px] font-bold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
        active
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-line-strong bg-surface text-ink hover:border-brand-500 hover:text-brand-700",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
