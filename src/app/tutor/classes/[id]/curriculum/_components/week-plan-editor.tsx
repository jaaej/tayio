"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Link2, Paperclip, X } from "lucide-react";
import { promoteAttachment } from "@/app/_actions/resources";
import {
  addWeekPlanLink,
  finalizeWeekPlanAttachmentUpload,
  prepareWeekPlanAttachmentUpload,
  removeWeekPlanAttachment,
  saveWeekPlanBody,
} from "@/app/tutor/_actions";
import { Button, Pill } from "@/components/admin/ui";
import { createClient } from "@/lib/supabase/client";
import { RESOURCE_TYPES } from "@/lib/resource-types";
import { httpHref } from "@/lib/safe-url";
import { cn } from "@/lib/utils";
import type { TutorSectionAttachment } from "../_queries";

type Attachment = TutorSectionAttachment & { href: string | null };
type SaveState = "saved" | "dirty" | "saving" | "error";

const AUTOSAVE_MS = 1200;
const FIELD =
  "w-full rounded-[11px] border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10";

/**
 * "For students this week": one text box per class per week, saved as you
 * type, plus file and link attachments. Students and parents read the same
 * field on their week view and on each lesson of the week.
 */
export function WeekPlanEditor({
  classId,
  subjectWeekId,
  initialBody,
  attachments,
  topics,
}: {
  classId: string;
  subjectWeekId: string;
  initialBody: string;
  attachments: Attachment[];
  topics: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last text the server has, and the latest text typed, for the save
  // loop and the unmount flush.
  const savedRef = useRef(initialBody);
  const latestRef = useRef(initialBody);
  const savingRef = useRef(false);

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (savingRef.current) return;
    const text = latestRef.current;
    if (text === savedRef.current) {
      setState("saved");
      return;
    }
    savingRef.current = true;
    setState("saving");
    const formData = new FormData();
    formData.set("classId", classId);
    formData.set("subjectWeekId", subjectWeekId);
    formData.set("body", text);
    try {
      const res = await saveWeekPlanBody(formData);
      if (!res.ok) throw new Error(res.error);
      savedRef.current = text;
      setState(latestRef.current === text ? "saved" : "dirty");
    } catch {
      setState("error");
    } finally {
      savingRef.current = false;
    }
    // Typed while the request was in flight: save the newer text too.
    if (latestRef.current !== savedRef.current && !timer.current) {
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    }
  }, [classId, subjectWeekId]);

  function onChange(value: string) {
    setBody(value);
    latestRef.current = value;
    setState(value === savedRef.current ? "saved" : "dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }

  // Leaving the week (or the page) with typing not yet saved: save it now,
  // and ask the browser to hold a full unload while it is outstanding.
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (latestRef.current !== savedRef.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      if (timer.current) clearTimeout(timer.current);
      if (latestRef.current !== savedRef.current && !savingRef.current) {
        const formData = new FormData();
        formData.set("classId", classId);
        formData.set("subjectWeekId", subjectWeekId);
        formData.set("body", latestRef.current);
        void saveWeekPlanBody(formData).catch(() => undefined);
      }
    };
  }, [classId, subjectWeekId]);

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await task();
        if (!res.ok) setError(res.error ?? "Something went wrong. Try again.");
        else router.refresh();
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }

  function uploadFile(file: File) {
    run(async () => {
      const prepared = await prepareWeekPlanAttachmentUpload({
        classId,
        subjectWeekId,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (!prepared.ok) return prepared;
      const { error: uploadError } = await createClient()
        .storage.from(prepared.value.bucket)
        .uploadToSignedUrl(prepared.value.path, prepared.value.token, file, {
          contentType: prepared.value.contentType,
        });
      if (uploadError) return { ok: false, error: "The file could not be uploaded. Try again." };
      return finalizeWeekPlanAttachmentUpload({
        classId,
        subjectWeekId,
        ticket: prepared.value.ticket,
      });
    });
  }

  function addLink(formData: FormData) {
    formData.set("classId", classId);
    formData.set("subjectWeekId", subjectWeekId);
    run(async () => {
      const res = await addWeekPlanLink(formData);
      if (res.ok) setLinkOpen(false);
      return res;
    });
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => void save()}
        rows={5}
        maxLength={5000}
        aria-label="For students this week"
        placeholder="What you'll cover, what to bring, what to revise"
        className={cn(FIELD, "resize-y px-3.5 py-3 leading-relaxed")}
      />

      {attachments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {attachments.map((att) => (
            <AttachmentRow
              key={att.id}
              att={att}
              topics={topics}
              disabled={pending}
              onRemove={() =>
                run(() => removeWeekPlanAttachment(att.id, classId))
              }
            />
          ))}
        </ul>
      )}

      {linkOpen && (
        <form
          action={addLink}
          className="flex flex-wrap items-end gap-2 rounded-[12px] bg-surface-2 p-2.5"
        >
          <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-[12px] font-bold text-ink">
            Label
            <input
              name="label"
              required
              maxLength={200}
              placeholder="e.g. Desmos: graph both lines"
              className={cn(FIELD, "h-10")}
            />
          </label>
          <label className="flex min-w-[200px] flex-[2] flex-col gap-1 text-[12px] font-bold text-ink">
            Link
            <input
              name="url"
              type="url"
              required
              maxLength={2000}
              placeholder="https://"
              className={cn(FIELD, "h-10")}
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Add link
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) uploadFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" aria-hidden />
            {pending ? "Working…" : "Attach file"}
          </Button>
          {!linkOpen && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setLinkOpen(true)}
            >
              <Link2 className="h-4 w-4" aria-hidden />
              Add link
            </Button>
          )}
        </div>
        <SaveStatus state={state} onRetry={() => void save()} />
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") {
    return (
      <span role="alert" className="flex items-center gap-2 text-[12px] font-bold text-bad">
        Not saved
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </span>
    );
  }
  const label = state === "saved" ? "Saved" : state === "saving" ? "Saving…" : "Unsaved changes";
  return (
    <span
      aria-live="polite"
      className={cn(
        "flex items-center gap-[5px] text-[12px] font-bold",
        state === "saved" ? "text-good" : "text-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-[7px] w-[7px] rounded-full",
          state === "saved" ? "bg-good" : "bg-muted-2",
        )}
      />
      {label}
    </span>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentMeta(att: Attachment): string | null {
  if (att.kind === "link") {
    try {
      return new URL(att.url ?? "").hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }
  const ext = att.fileName.split(".").pop()?.toUpperCase();
  return [ext, att.sizeBytes ? formatBytes(att.sizeBytes) : null]
    .filter(Boolean)
    .join(" · ");
}

function AttachmentRow({
  att,
  topics,
  disabled,
  onRemove,
}: {
  att: Attachment;
  topics: Array<{ id: string; name: string }>;
  disabled: boolean;
  onRemove: () => void;
}) {
  const Icon = att.kind === "link" ? Link2 : FileText;
  const href = httpHref(att.href);
  const meta = attachmentMeta(att);
  return (
    <li className="flex flex-col gap-2 rounded-[12px] bg-surface-2 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-surface text-ink-soft">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-[1_1_200px] text-[13px] font-bold text-ink">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-ink hover:underline"
            >
              {att.fileName}
            </a>
          ) : (
            <span className="break-words">{att.fileName}</span>
          )}
          {meta && <span className="font-medium text-muted"> · {meta}</span>}
        </span>
        <LibraryControl attachmentId={att.id} promoted={att.promoted} topics={topics} />
        {/* A promoted file is served from the library too; the server
            refuses removal until it is taken out of the library. */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Remove ${att.fileName}`}
          title="Remove"
          className="h-[30px] w-[30px] rounded-[8px]"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </li>
  );
}

/** "Add to library": publish the attachment to the subject resource library. */
function LibraryControl({
  attachmentId,
  promoted,
  topics,
}: {
  attachmentId: string;
  promoted: boolean;
  topics: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(promoted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <Pill tone="good" className="h-[22px] px-2 text-[11px]">
        In library
      </Pill>
    );
  }
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add to library
      </Button>
    );
  }

  function submit(formData: FormData) {
    formData.set("attachmentId", attachmentId);
    setError(null);
    startTransition(async () => {
      try {
        const res = await promoteAttachment(formData);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setDone(true);
        setOpen(false);
        router.refresh();
      } catch {
        setError("Could not add it to the library. Try again.");
      }
    });
  }

  const select =
    "h-[30px] rounded-[8px] border border-line-strong bg-surface px-2 text-[12px] font-semibold text-ink focus:border-ink focus:outline-none";
  return (
    <form action={submit} className="flex w-full flex-wrap items-center justify-end gap-2">
      <select name="type" required defaultValue="" aria-label="Resource type" className={select}>
        <option value="" disabled>
          Type
        </option>
        {RESOURCE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select name="topicId" defaultValue="" aria-label="Topic" className={select}>
        <option value="">No topic</option>
        {topics.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add to library"}
      </Button>
      {error && (
        <span role="alert" className="w-full text-right text-[12px] font-semibold text-bad">
          {error}
        </span>
      )}
    </form>
  );
}
