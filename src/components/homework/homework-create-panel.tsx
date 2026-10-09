"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  createAdminHomework,
  prepareAdminHomeworkAttachmentUpload,
} from "@/app/admin/_lib/actions-homework";
import {
  createHomework as createTutorHomework,
  prepareTutorHomeworkAttachmentUpload,
} from "@/app/tutor/_actions";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { createClient } from "@/lib/supabase/client";

export type HomeworkClassOption = { id: string; label: string };

export function HomeworkCreatePanel({
  actor,
  weekId,
  classes,
  initialClassId,
}: {
  actor: "admin" | "tutor";
  weekId: string;
  classes: HomeworkClassOption[];
  initialClassId?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const defaultClassId = initialClassId ?? classes[0]?.id ?? "";

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const classId = String(formData.get("classId") ?? "");
        if (actor === "tutor" && !classId) {
          setError("Choose a class");
          return;
        }

        const file = formData.get("attachment");
        if (file instanceof File && file.size > 0) {
          const input = {
            classId,
            subjectWeekId: weekId,
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          };
          const prepared =
            actor === "admin"
              ? await prepareAdminHomeworkAttachmentUpload(input)
              : await prepareTutorHomeworkAttachmentUpload(input);
          if (!prepared.ok) {
            setError(prepared.error);
            return;
          }

          const supabase = createClient();
          const { error: uploadError } = await supabase.storage
            .from(prepared.value.bucket)
            .uploadToSignedUrl(prepared.value.path, prepared.value.token, file, {
              contentType: prepared.value.contentType,
            });
          if (uploadError) {
            setError(uploadError.message);
            return;
          }
          formData.set("uploadTicket", prepared.value.ticket);
        }

        formData.set("weekId", weekId);
        formData.delete("attachment");
        const result =
          actor === "admin"
            ? await createAdminHomework(formData)
            : await createTutorHomework(formData);
        if (result && "ok" in result && !result.ok) {
          setError(result.error);
          return;
        }

        formRef.current?.reset();
        setSaved(true);
        setOpen(false);
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Homework could not be saved.",
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setSaved(false);
          setOpen((current) => !current);
        }}
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 text-[12px] font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {open ? "Close form" : "Add homework"}
      </button>

      {saved && (
        <p
          role="status"
          className="rounded-[10px] border border-good/35 bg-good-bg px-3 py-2 text-[12px] font-semibold text-good"
        >
          Homework saved.
        </p>
      )}

      {open && (
        <form
          ref={formRef}
          action={submit}
          className="space-y-3 rounded-[14px] border border-line bg-surface-2 p-4"
        >
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
            New homework
          </div>
          {actor === "tutor" && classes.length === 1 ? (
            <input type="hidden" name="classId" value={defaultClassId} />
          ) : (
            <label className="block space-y-1.5">
              <span className="text-[12px] font-bold text-ink-soft">
                {actor === "admin" ? "Assign to" : "Class"}
              </span>
              <select
                name="classId"
                required={actor === "tutor"}
                defaultValue={defaultClassId}
                className={INPUT}
              >
                {actor === "admin" && (
                  <option value="">Subject only - not assigned</option>
                )}
                {classes.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Homework title"
            className={INPUT}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-bold text-ink-soft">Due date</span>
              <input
                name="dueDate"
                type="datetime-local"
                required
                className={INPUT}
              />
            </label>
            <div className="flex flex-col justify-end gap-2 pb-2">
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  name="allowResubmission"
                  className="accent-brand-600"
                />
                Allow resubmission
              </label>
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  name="isTest"
                  className="accent-brand-600"
                />
                Mark as test
              </label>
            </div>
          </div>
          <textarea
            name="description"
            rows={3}
            maxLength={5000}
            placeholder="Instructions (optional)"
            className={`${INPUT} h-auto py-2`}
          />
          <label className="block space-y-1.5">
            <span className="text-[12px] font-bold text-ink-soft">
              Worksheet or test file (optional)
            </span>
            <input
              name="attachment"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt"
              className="block w-full text-[12px] text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-ink hover:file:bg-brand-50"
            />
          </label>
          <p className="text-[11px] text-muted">
            Add the solution after saving. It stays hidden from students until
            the due date.
          </p>
          {error && (
            <p role="alert" className="text-[12px] font-semibold text-bad">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <ActionButtonLabel pending={pending} pendingLabel="Saving…">
              {actor === "admin" ? "Save homework" : "Assign homework"}
            </ActionButtonLabel>
          </button>
        </form>
      )}
    </div>
  );
}

const INPUT =
  "min-h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";
