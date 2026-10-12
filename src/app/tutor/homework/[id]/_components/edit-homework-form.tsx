"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText } from "lucide-react";
import {
  prepareTutorHomeworkEditAttachmentUpload,
  updateHomework,
} from "@/app/tutor/_actions";
import { Label } from "@/components/ui/input";
import { Button } from "@/components/admin/ui";
import { ActionSpinner } from "@/components/ui/loading-button";
import { FileViewerButton } from "@/components/ui/file-viewer";
import { createClient } from "@/lib/supabase/client";

const INPUT_CLS =
  "h-10 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10";

/** The homework's own details, edited from the Marking page's settings panel. */
export function EditHomeworkForm({
  homeworkId,
  title,
  description,
  dueDate,
  allowResubmission,
  isTest,
  hasAttachment,
  attachmentHref,
}: {
  homeworkId: string;
  title: string;
  description: string | null;
  dueDate: string;
  allowResubmission: boolean;
  isTest: boolean;
  hasAttachment: boolean;
  attachmentHref: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const file = formData.get("attachment");
      if (file instanceof File && file.size > 0) {
        const prepared = await prepareTutorHomeworkEditAttachmentUpload({
          homeworkId,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });
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

      // Files go browser-to-Storage. Only normal fields and the signed ticket
      // are sent to the Server Action, keeping the request below Vercel's cap.
      formData.delete("attachment");
      try {
        await updateHomework(formData);
      } catch {
        setError(
          "The homework could not be saved. Check the fields and try again.",
        );
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="homeworkId" value={homeworkId} />

      <div className="space-y-1">
        <Label htmlFor="edit-title">Title</Label>
        <input
          id="edit-title"
          name="title"
          required
          defaultValue={title}
          maxLength={200}
          className={INPUT_CLS}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="edit-due">Due date</Label>
          <input
            id="edit-due"
            name="dueDate"
            type="datetime-local"
            required
            defaultValue={dueDate}
            className={INPUT_CLS}
          />
        </div>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              name="allowResubmission"
              defaultChecked={allowResubmission}
              className="accent-brand-600"
            />
            Allow resubmission
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              name="isTest"
              defaultChecked={isTest}
              className="accent-brand-600"
            />
            Mark as test (counts toward rankings)
          </label>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="edit-description">Description</Label>
        <textarea
          id="edit-description"
          name="description"
          rows={3}
          defaultValue={description ?? ""}
          placeholder="Description (optional)"
          className={`${INPUT_CLS} h-auto py-2`}
        />
      </div>

      <div className="space-y-1">
        {hasAttachment && (
          <div className="mb-3 flex items-center gap-3 rounded-[12px] border border-brand-200 bg-brand-50 p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-surface text-brand-600">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-ink">
                Current homework attachment
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                Open the current file, replace it below, or remove it.
              </p>
            </div>
            {attachmentHref && (
              <FileViewerButton
                url={attachmentHref}
                title={`${title} attachment`}
                className="shrink-0 px-3 text-[11px]"
              >
                View file
              </FileViewerButton>
            )}
          </div>
        )}
        <Label htmlFor="edit-attachment">
          {hasAttachment ? "Replace attachment" : "Add attachment"}
        </Label>
        <input
          id="edit-attachment"
          name="attachment"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt"
          className="block w-full text-[12px] text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-brand-700 hover:file:bg-brand-100"
        />
        {hasAttachment && (
          <label className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-soft">
            <input
              type="checkbox"
              name="removeAttachment"
              className="accent-brand-600"
            />
            Remove the current attachment
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && (
          <span
            role="status"
            className="inline-flex items-center gap-1 text-[13px] font-bold text-good"
          >
            <Check className="h-4 w-4" aria-hidden />
            Saved
          </span>
        )}
        <Button
          type="submit"
          disabled={pending}
          className="h-10 rounded-[11px] px-4"
        >
          {pending && <ActionSpinner />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
